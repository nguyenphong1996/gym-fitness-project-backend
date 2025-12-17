const StaffAvailability = require('../models/StaffAvailability');
const { SLOT_DEFINITIONS, normalizeDate } = require('../utils/ptSlots');
const { logError, logSuccess } = require('../utils/logger');

const ALLOWED_SLOT_KEYS = new Set(SLOT_DEFINITIONS.map((slot) => slot.key));

// 🚀 THÊM MỚI: Validation thời gian cho slots
const isSlotTimeValid = (slotKey, checkDate = new Date()) => {
  const now = new Date();
  const [startTime, endTime] = slotKey.split('-');
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Parse check date
  const checkDateTime = new Date(checkDate);
  checkDateTime.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Chỉ validate nếu check date là ngày hôm nay
  if (checkDateTime.getTime() !== today.getTime()) {
    return { isValid: true, reason: null };
  }

  // Tạo datetime objects cho slot
  const slotStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startHour, startMinute);
  const slotEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endHour, endMinute);

  if (now >= slotEnd) {
    return { 
      isValid: false, 
      reason: `Ca ${slotKey} đã kết thúc lúc ${endTime}` 
    };
  }

  if (now >= slotStart) {
    return { 
      isValid: false, 
      reason: `Ca ${slotKey} đã bắt đầu lúc ${startTime}` 
    };
  }

  return { isValid: true, reason: null };
};

// 🚀 THÊM MỚI: Validate toàn bộ array slots
const validateSlotsArray = (slots, date) => {
  const invalidSlots = [];
  
  for (const slot of slots) {
    const timeCheck = isSlotTimeValid(slot, date);
    if (!timeCheck.isValid) {
      invalidSlots.push({
        slot,
        reason: timeCheck.reason
      });
    }
  }

  if (invalidSlots.length > 0) {
    const errorMessages = invalidSlots.map(item => `${item.slot}: ${item.reason}`).join(', ');
    throw new Error(`Các ca không hợp lệ: ${errorMessages}`);
  }

  return true;
};

exports.getMyAvailability = async (req, res) => {
  const context = 'staffAvailabilityController.getMyAvailability';
  try {
    const normalizedDate = normalizeDate(req.query.date || new Date());
    if (!normalizedDate) {
      return res.status(400).json({
        error: 'invalid_date',
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const availability = await StaffAvailability.findOne({
      staffId: req.user.id,
      date: normalizedDate
    });

    logSuccess(context, 'Fetched staff availability', {
      staffId: req.user.id,
      date: normalizedDate.toISOString(),
      slots: availability?.slots?.length || 0
    });

    return res.json({
      success: true,
      date: normalizedDate.toISOString(),
      slots: availability?.slots || []
    });
  } catch (error) {
    logError(context, 'Failed to fetch availability', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to fetch availability'
    });
  }
};

exports.setMyAvailability = async (req, res) => {
  const context = 'staffAvailabilityController.setMyAvailability';
  try {
    const { date, slots } = req.body || {};
    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({
        error: 'invalid_date',
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    if (!Array.isArray(slots)) {
      return res.status(400).json({
        error: 'invalid_slots',
        message: 'Slots must be an array of slot keys'
      });
    }

    const uniqueSlots = Array.from(new Set(slots.map((s) => String(s).trim()).filter(Boolean)));
    if (uniqueSlots.length === 0) {
      return res.status(400).json({
        error: 'empty_slots',
        message: 'Please select at least one slot'
      });
    }

    const invalidSlots = uniqueSlots.filter((slotKey) => !ALLOWED_SLOT_KEYS.has(slotKey));
    if (invalidSlots.length > 0) {
      return res.status(400).json({
        error: 'invalid_slot_keys',
        message: `Invalid slot keys: ${invalidSlots.join(', ')}`
      });
    }

    // 🚀 THÊM MỚI: Validate thời gian cho slots
    try {
      validateSlotsArray(uniqueSlots, normalizedDate);
    } catch (timeValidationError) {
      return res.status(400).json({
        error: 'invalid_slot_time',
        message: timeValidationError.message
      });
    }

    const availability = await StaffAvailability.findOneAndUpdate(
      { staffId: req.user.id, date: normalizedDate },
      {
        $set: { slots: uniqueSlots, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { new: true, upsert: true }
    );

    logSuccess(context, 'Saved staff availability', {
      staffId: req.user.id,
      date: normalizedDate.toISOString(),
      slots: availability.slots.length
    });

    return res.json({
      success: true,
      message: 'Availability saved',
      date: normalizedDate.toISOString(),
      slots: availability.slots
    });
  } catch (error) {
    logError(context, 'Failed to save availability', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to save availability'
    });
  }
};
