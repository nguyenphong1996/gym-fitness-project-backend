const PtBooking = require('../models/PtBooking');
const { normalizeDate } = require('../utils/ptSlots');
const { logError, logSuccess } = require('../utils/logger');

exports.getStaffBookings = async (req, res) => {
  const context = 'staffBookingController.getStaffBookings';
  try {
    const { date, from, to, status = 'upcoming' } = req.query;
    const staffId = req.user.id;

    const filter = { staffId };

    const now = new Date();
    let rangeStart = null;
    let rangeEnd = null;

    if (date) {
      const normalized = normalizeDate(date);
      if (!normalized) {
        return res.status(400).json({
          error: 'invalid_date',
          message: 'Invalid date format. Use YYYY-MM-DD'
        });
      }
      rangeStart = normalized;
      rangeEnd = new Date(normalized);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
    } else if (from || to) {
      if (from) {
        const normalizedFrom = normalizeDate(from);
        if (!normalizedFrom) {
          return res.status(400).json({
            error: 'invalid_from',
            message: 'Invalid from date'
          });
        }
        rangeStart = normalizedFrom;
      }
      if (to) {
        const normalizedTo = normalizeDate(to);
        if (!normalizedTo) {
          return res.status(400).json({
            error: 'invalid_to',
            message: 'Invalid to date'
          });
        }
        rangeEnd = new Date(normalizedTo);
        rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
      }
    }

    if (rangeStart || rangeEnd) {
      filter.startTime = {};
      if (rangeStart) filter.startTime.$gte = rangeStart;
      if (rangeEnd) filter.startTime.$lt = rangeEnd;
    }

    if (status === 'upcoming') {
      filter.status = 'confirmed';
      filter.startTime = filter.startTime || {};
      filter.startTime.$gte = filter.startTime.$gte || now;
    } else if (status === 'history') {
      filter.endTime = filter.endTime || {};
      filter.endTime.$lt = now;
    } else if (status === 'cancelled') {
      filter.status = 'cancelled';
    } else if (status !== 'all') {
      return res.status(400).json({
        error: 'invalid_status',
        message: 'Status must be one of: upcoming, history, cancelled, all'
      });
    }

    const bookings = await PtBooking.find(filter)
      .populate('customerId', 'name phone')
      .sort({ startTime: 1 });

    logSuccess(context, 'Fetched staff bookings', { staffId, total: bookings.length });

    return res.json({
      success: true,
      data: bookings.map((booking) => ({
        id: booking._id,
        customer: booking.customerId
          ? {
              id: booking.customerId._id,
              name: booking.customerId.name,
              phone: booking.customerId.phone
            }
          : null,
        slotKey: booking.slotKey,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        notes: booking.notes || null,
        cancelledAt: booking.cancelledAt || null
      }))
    });
  } catch (error) {
    logError(context, 'Failed to fetch staff bookings', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch staff bookings'
    });
  }
};
