const PtBooking = require('../models/PtBooking');
const User = require('../models/User');
const Class = require('../models/Class');
const StaffAvailability = require('../models/StaffAvailability');
const MembershipPackage = require('../models/MembershipPackage');
const {
  buildSlotsForDate,
  findSlotByKey,
  normalizeDate,
  overlaps
} = require('../utils/ptSlots');
const { logError, logSuccess, logWarning, logDebug } = require('../utils/logger');
const { PT_BOOKING_BASE_PRICE } = require('../config/pricing');

const ACTIVE_CLASS_STATUSES = [
  'scheduled',
  'waiting_pt',
  'on_going',
  'on_going_waiting_customers',
  'waiting_checkout'
];

const BOOKING_STATUS_ACTIVE = ['pending_staff', 'confirmed'];

exports.listActiveStaff = async (req, res) => {
  const context = 'ptBookingController.listActiveStaff';
  try {
    const {
      skill,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const query = {
      role: 'staff',
      isActive: true,
      skillsApprovedByAdmin: true
    };

    if (skill) {
      const skillsArray = Array.isArray(skill)
        ? skill
        : String(skill).split(',').map((s) => s.trim()).filter(Boolean);

      if (skillsArray.length > 0) {
        query.skills = { $all: skillsArray };
      }
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { phone: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [staffList, total] = await Promise.all([
      User.find(query)
        .select('_id name phone skills avatar.url')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

    logSuccess(context, 'Fetched active PT list for customer', {
      total: staffList.length,
      page: pageNum
    });

    return res.json({
      success: true,
      data: staffList.map((staff) => ({
        id: staff._id,
        name: staff.name,
        phone: staff.phone,
        skills: staff.skills || [],
        avatar: staff.avatar?.url || null
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    logError(context, 'Failed to list active PT', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to list PT'
    });
  }
};

function formatBookingResponse(booking, options = {}) {
  const { includeStaff = false, includeCustomer = false } = options;
  const payload = {
    id: booking._id,
    staffId: booking.staffId,
    customerId: booking.customerId,
    slotKey: booking.slotKey,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    notes: booking.notes || null,
    cancelledAt: booking.cancelledAt || null,
    pricing: {
      priceCharged: booking.priceCharged ?? 0,
      discountPercent: booking.discountPercent ?? 0,
      usedMembershipSession: booking.usedMembershipSession ?? false
    }
  };

  // Include refund info if booking is cancelled
  if (booking.status === 'cancelled' && booking.cancelledAt) {
    payload.refund = {
      refundAmount: booking.refundAmount ?? 0,
      refundPercent: booking.refundPercent ?? 0,
      sessionRestored: booking.sessionRestored ?? false
    };
  }

  if (includeStaff && booking.staff) {
    payload.staff = {
      id: booking.staff._id,
      name: booking.staff.name,
      phone: booking.staff.phone
    };
  }

  if (includeCustomer && booking.customer) {
    payload.customer = {
      id: booking.customer._id,
      name: booking.customer.name,
      phone: booking.customer.phone
    };
  }

  return payload;
}

async function ensureStaffExists(staffId) {
  if (!staffId || !staffId.match(/^[0-9a-f]{24}$/)) {
    logWarning('ensureStaffExists', `Invalid staffId format: ${staffId}`);
    return null;
  }

  const staff = await User.findOne({ _id: staffId, role: 'staff', isActive: true });
  if (!staff) {
    // Check if staff exists but is inactive or wrong role
    const anyStaff = await User.findById(staffId);
    if (anyStaff) {
      logWarning('ensureStaffExists', `Staff found but invalid: ${staffId}`, {
        role: anyStaff.role,
        isActive: anyStaff.isActive
      });
    } else {
      logWarning('ensureStaffExists', `Staff not found in DB: ${staffId}`);
    }
    return null;
  }
  return staff;
}

async function fetchBlockingClasses(staffId, dayStart, dayEnd) {
  return Class.find({
    staffId,
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
    status: { $in: ACTIVE_CLASS_STATUSES }
  }).select('_id name startTime endTime status');
}

exports.getAvailability = async (req, res) => {
  const context = 'ptBookingController.getAvailability';
  try {
    const { staffId, date } = req.query;

    // Log request for debugging
    logDebug(context, 'Request availability', { staffId, date, userId: req.user.id });

    if (!staffId) {
      return res.status(400).json({
        error: 'missing_staff',
        message: 'staffId is required'
      });
    }

    const normalizedDate = normalizeDate(date || new Date());
    if (!normalizedDate) {
      return res.status(400).json({
        error: 'invalid_date',
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const staff = await ensureStaffExists(staffId);
    if (!staff) {
      return res.status(404).json({
        error: 'staff_not_found',
        message: `Staff not found or inactive. ID: ${staffId}`
      });
    }

    const slots = buildSlotsForDate(normalizedDate);
    if (!slots) {
      return res.status(400).json({
        error: 'invalid_date',
        message: 'Cannot build slots for the provided date'
      });
    }

    const dayStart = new Date(normalizedDate);
    const dayEnd = new Date(normalizedDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [bookings, blockingClasses, staffAvailability] = await Promise.all([
      PtBooking.find({
        staffId,
        status: { $in: BOOKING_STATUS_ACTIVE },
        startTime: { $gte: dayStart, $lt: dayEnd }
      }).select('_id startTime endTime customerId slotKey status'),
      fetchBlockingClasses(staffId, dayStart, dayEnd),
      StaffAvailability.findOne({ staffId, date: normalizedDate })
    ]);

    logDebug(context, 'Availability check', {
      staffId,
      date: normalizedDate,
      hasAvailabilityRecord: !!staffAvailability,
      slots: staffAvailability?.slots
    });

    const availableSlotKeys = staffAvailability ? new Set(staffAvailability.slots) : new Set();

    const responseSlots = slots.map((slot) => {
      // If PT has not opened this slot, mark as unavailable
      if (!availableSlotKeys.has(slot.key)) {
        return {
          ...slot,
          status: 'unavailable'
        };
      }

      const existingBooking = bookings.find((booking) =>
        overlaps(slot.startTime, slot.endTime, booking.startTime, booking.endTime)
      );

      if (existingBooking) {
        return {
          ...slot,
          status: existingBooking.customerId.equals(req.user.id) ? 'booked_by_you' : 'booked',
          bookingId: existingBooking._id,
          isMine: existingBooking.customerId.equals(req.user.id)
        };
      }

      const blockingClass = blockingClasses.find((klass) =>
        overlaps(slot.startTime, slot.endTime, klass.startTime, klass.endTime)
      );

      if (blockingClass) {
        return {
          ...slot,
          status: 'blocked',
          conflict: {
            type: 'class',
            classId: blockingClass._id,
            className: blockingClass.name,
            classStatus: blockingClass.status
          }
        };
      }

      return {
        ...slot,
        status: 'available'
      };
    });

    logSuccess(context, 'Fetched PT availability', { staffId, date: normalizedDate.toISOString() });

    return res.json({
      success: true,
      staff: {
        id: staff._id,
        name: staff.name,
        phone: staff.phone,
        avatar: staff.avatar?.url || null
      },
      date: normalizedDate.toISOString(),
      slots: responseSlots
    });
  } catch (error) {
    logError(context, 'Failed to get availability', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to get PT availability'
    });
  }
};

exports.createBooking = async (req, res) => {
  const context = 'ptBookingController.createBooking';
  try {
    const { staffId, date, slotKey, note } = req.body;

    if (!staffId || !date || !slotKey) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'staffId, date and slotKey are required'
      });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({
        error: 'invalid_date',
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const slot = findSlotByKey(normalizedDate, slotKey);
    if (!slot) {
      return res.status(400).json({
        error: 'invalid_slot',
        message: 'Slot key is invalid for the provided date'
      });
    }

    const now = new Date();
    if (slot.startTime <= now) {
      return res.status(400).json({
        error: 'slot_in_past',
        message: 'Cannot book a slot in the past'
      });
    }

    const staff = await ensureStaffExists(staffId);
    if (!staff) {
      return res.status(404).json({
        error: 'staff_not_found',
        message: 'Staff not found or inactive'
      });
    }

    // Check if staff has opened this slot
    const staffAvailability = await StaffAvailability.findOne({ staffId, date: normalizedDate });
    if (!staffAvailability || !staffAvailability.slots.includes(slotKey)) {
      return res.status(400).json({
        error: 'slot_unavailable',
        message: 'Staff is not working during this slot'
      });
    }

    const [staffConflict, customerConflict, classConflict] = await Promise.all([
      PtBooking.findOne({
        staffId,
        status: { $in: BOOKING_STATUS_ACTIVE },
        startTime: { $lt: slot.endTime },
        endTime: { $gt: slot.startTime }
      }),
      PtBooking.findOne({
        customerId: req.user.id,
        status: { $in: BOOKING_STATUS_ACTIVE },
        startTime: { $lt: slot.endTime },
        endTime: { $gt: slot.startTime }
      }),
      Class.findOne({
        staffId,
        startTime: { $lt: slot.endTime },
        endTime: { $gt: slot.startTime },
        status: { $in: ACTIVE_CLASS_STATUSES }
      }).select('_id name startTime endTime status')
    ]);

    if (staffConflict) {
      return res.status(409).json({
        error: 'slot_taken',
        message: 'This slot has already been booked'
      });
    }

    if (customerConflict) {
      return res.status(409).json({
        error: 'customer_busy',
        message: 'You already have a booking at this time'
      });
    }

    if (classConflict) {
      return res.status(409).json({
        error: 'slot_blocked',
        message: 'Staff is teaching a class during this slot',
        conflict: {
          classId: classConflict._id,
          className: classConflict.name
        }
      });
    }

    // ============ PRICING LOGIC: Check membership & calculate price ============
    const customer = await User.findById(req.user.id).populate('membership.packageId');
    if (!customer) {
      return res.status(404).json({
        error: 'customer_not_found',
        message: 'Customer not found'
      });
    }

    const membership = customer.membership;
    const isMembershipActive = 
      membership?.status === 'active' && 
      membership.endDate && 
      new Date(membership.endDate) > now;

    let priceCharged = PT_BOOKING_BASE_PRICE; // Default: 350,000 VND
    let discountPercent = 0;
    let usedMembershipSession = false;

    // Check if customer has active membership with PT benefits
    if (isMembershipActive && membership.packageId) {
      const pkg = membership.packageId;
      const remainingSessions = membership.remainingSessions ?? 0;

      // CASE 1: Customer has free PT sessions remaining
      if (remainingSessions > 0) {
        priceCharged = 0;
        usedMembershipSession = true;
        // Will deduct after booking is created
        logDebug(context, 'Using free PT session', {
          customerId: req.user.id,
          remainingSessions,
          packageName: pkg.name
        });
      } 
      // CASE 2: No free sessions, but Premium gets 20% discount
      else if (pkg.ptBookingDiscountPercent > 0) {
        discountPercent = pkg.ptBookingDiscountPercent;
        priceCharged = Math.round(PT_BOOKING_BASE_PRICE * (1 - discountPercent / 100));
        logDebug(context, 'Applying PT booking discount', {
          customerId: req.user.id,
          packageName: pkg.name,
          discountPercent,
          priceCharged
        });
      }
      // CASE 3: No free sessions, no discount (Basic, Plus after free sessions)
      else {
        priceCharged = PT_BOOKING_BASE_PRICE;
      }
    } else {
      // No active membership or expired
      priceCharged = PT_BOOKING_BASE_PRICE;
    }

    if (priceCharged < 0) priceCharged = 0;

    // Create booking with pricing information
    const booking = await PtBooking.create({
      staffId,
      customerId: req.user.id,
      date: normalizedDate,
      slotKey,
      startTime: slot.startTime,
      endTime: slot.endTime,
      notes: note ? String(note).trim().slice(0, 500) : undefined,
      status: 'pending_staff',
      priceCharged,
      discountPercent,
      usedMembershipSession
    });

    // Deduct membership session if used
    if (usedMembershipSession) {
      membership.remainingSessions = (membership.remainingSessions ?? 0) - 1;
      await customer.save();
      logSuccess(context, 'Deducted PT session from membership', {
        customerId: req.user.id,
        remainingSessions: membership.remainingSessions
      });
    }

    logSuccess(context, 'Customer booked PT slot', {
      bookingId: booking._id,
      staffId,
      customerId: req.user.id,
      priceCharged,
      usedMembershipSession
    });

    return res.status(201).json({
      success: true,
      message: 'PT booked successfully',
      booking: {
        ...formatBookingResponse(booking),
        pricing: {
          priceCharged,
          discountPercent,
          usedMembershipSession
        }
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'slot_taken',
        message: 'This slot has already been booked'
      });
    }
    logError(context, 'Failed to create PT booking', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to create PT booking'
    });
  }
};

exports.getCustomerBookings = async (req, res) => {
  const context = 'ptBookingController.getCustomerBookings';
  try {
    const { status = 'upcoming', page = 1, limit = 10 } = req.query;
    const filter = { customerId: req.user.id };
    const now = new Date();

    if (status === 'upcoming') {
      filter.status = { $in: BOOKING_STATUS_ACTIVE };
      filter.startTime = { $gte: now };
    } else if (status === 'history') {
      filter.endTime = { $lt: now };
    } else if (status === 'cancelled') {
      filter.status = 'cancelled';
    } else if (status !== 'all') {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'Status must be one of: upcoming, history, cancelled, all'
      });
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [bookings, total] = await Promise.all([
      PtBooking.find(filter)
        .populate('staffId', 'name phone')
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      PtBooking.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: bookings.map((booking) => ({
        ...formatBookingResponse(booking, { includeStaff: true }),
        staff: booking.staffId
          ? {
              id: booking.staffId._id,
              name: booking.staffId.name,
              phone: booking.staffId.phone
            }
          : null
      })),
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10) || 1)
      }
    });
  } catch (error) {
    logError(context, 'Failed to fetch customer bookings', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch bookings'
    });
  }
};

exports.cancelBooking = async (req, res) => {
  const context = 'ptBookingController.cancelBooking';
  try {
    const { bookingId } = req.params;
    if (!bookingId || !bookingId.match(/^[0-9a-f]{24}$/)) {
      return res.status(400).json({
        error: 'invalid_booking_id',
        message: 'Invalid booking id'
      });
    }

    const booking = await PtBooking.findById(bookingId);
    if (!booking || booking.customerId.toString() !== req.user.id.toString()) {
      return res.status(404).json({
        error: 'booking_not_found',
        message: 'Booking not found'
      });
    }

    if (!['confirmed', 'pending_staff'].includes(booking.status)) {
      return res.status(400).json({
        error: 'cannot_cancel',
        message: 'Only pending or confirmed bookings can be cancelled'
      });
    }

    const now = new Date();
    if (booking.startTime <= now) {
      return res.status(400).json({
        error: 'already_started',
        message: 'Cannot cancel a booking that has started'
      });
    }

    // ============ CANCELLATION PENALTY POLICY ============
    const hoursUntilBooking = (booking.startTime - now) / (1000 * 60 * 60);
    let refundPercent = 0;
    let refundAmount = 0;
    let sessionRestored = false;

    // CASE 1: Cancel more than 24 hours before
    if (hoursUntilBooking > 24) {
      // Refund 80% of paid amount
      if (booking.priceCharged > 0) {
        refundPercent = 80;
        refundAmount = Math.round(booking.priceCharged * 0.8);
      }
      // Restore free session
      if (booking.usedMembershipSession) {
        sessionRestored = true;
        const customer = await User.findById(req.user.id);
        if (customer && customer.membership) {
          customer.membership.remainingSessions = (customer.membership.remainingSessions ?? 0) + 1;
          await customer.save();
          logSuccess(context, 'Restored PT session (>24h cancellation)', {
            customerId: req.user.id,
            remainingSessions: customer.membership.remainingSessions
          });
        }
      }
    } 
    // CASE 2: Cancel within 24 hours before
    else {
      // Refund only 50% of paid amount
      if (booking.priceCharged > 0) {
        refundPercent = 50;
        refundAmount = Math.round(booking.priceCharged * 0.5);
      }
      // Free session is LOST (no restore)
      sessionRestored = false;
      if (booking.usedMembershipSession) {
        logWarning(context, 'Free PT session lost due to late cancellation (<24h)', {
          customerId: req.user.id,
          bookingId
        });
      }
    }

    // Update booking with cancellation info
    booking.status = 'cancelled';
    booking.cancelledAt = now;
    booking.cancelledBy = req.user.id;
    booking.refundAmount = refundAmount;
    booking.refundPercent = refundPercent;
    booking.sessionRestored = sessionRestored;
    await booking.save();

    logSuccess(context, 'Customer cancelled PT booking', { 
      bookingId,
      hoursUntilBooking: hoursUntilBooking.toFixed(2),
      refundPercent,
      refundAmount,
      sessionRestored
    });

    return res.json({
      success: true,
      message: 'Booking cancelled successfully',
      cancellation: {
        refundAmount,
        refundPercent,
        sessionRestored,
        policy: hoursUntilBooking > 24 
          ? 'Hủy trước 24h: Hoàn 80% phí + hoàn lượt miễn phí'
          : 'Hủy trong 24h: Hoàn 50% phí + mất lượt miễn phí'
      }
    });
  } catch (error) {
    logError(context, 'Failed to cancel booking', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to cancel booking'
    });
  }
};

exports.getMyPtCredits = async (req, res) => {
  const context = 'ptBookingController.getMyPtCredits';
  try {
    const customer = await User.findById(req.user.id).populate('membership.packageId');
    
    if (!customer) {
      return res.status(404).json({
        error: 'customer_not_found',
        message: 'Customer not found'
      });
    }

    const membership = customer.membership;
    const now = new Date();
    const isMembershipActive = 
      membership?.status === 'active' && 
      membership.endDate && 
      new Date(membership.endDate) > now;

    if (!isMembershipActive || !membership.packageId) {
      return res.json({
        success: true,
        hasMembership: false,
        remainingSessions: 0,
        packageName: null,
        ptBookingPrice: PT_BOOKING_BASE_PRICE,
        discountPercent: 0
      });
    }

    const pkg = membership.packageId;
    const remainingSessions = membership.remainingSessions ?? 0;
    const discountPercent = pkg.ptBookingDiscountPercent ?? 0;
    const priceAfterDiscount = discountPercent > 0 
      ? Math.round(PT_BOOKING_BASE_PRICE * (1 - discountPercent / 100))
      : PT_BOOKING_BASE_PRICE;

    return res.json({
      success: true,
      hasMembership: true,
      packageName: pkg.name,
      packageTier: pkg.tier,
      remainingSessions,
      ptBookingBasePrice: PT_BOOKING_BASE_PRICE,
      discountPercent,
      priceAfterDiscount,
      membershipEndDate: membership.endDate,
      message: remainingSessions > 0 
        ? `Bạn còn ${remainingSessions} lượt PT miễn phí`
        : discountPercent > 0 
          ? `Bạn được giảm ${discountPercent}% khi booking PT (${priceAfterDiscount.toLocaleString()} VND)`
          : `Giá booking PT: ${PT_BOOKING_BASE_PRICE.toLocaleString()} VND`
    });
  } catch (error) {
    logError(context, 'Failed to get PT credits', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to get PT credits'
    });
  }
};
