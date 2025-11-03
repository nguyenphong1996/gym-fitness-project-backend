const Class = require('../models/Class');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const ClassAttendance = require('../models/ClassAttendance');
const { validateObjectId } = require('../utils/validation');
const {
  logError,
  logSuccess,
  logWarning,
  logDebug
} = require('../utils/logger');

const ALLOWED_CLASS_STATUSES = ['scheduled', 'ongoing'];
// Allow a short post-class window for check-out scans (minutes).
const rawGraceMinutes = parseInt(process.env.CLASS_CHECKOUT_GRACE_MINUTES || '15', 10);
const DEFAULT_CHECKOUT_GRACE_MINUTES = Number.isFinite(rawGraceMinutes) && rawGraceMinutes >= 0
  ? rawGraceMinutes
  : 15;

const markClassCompletedIfNeeded = async (classData, now = new Date()) => {
  if (!classData?.endTime) {
    return;
  }

  if (now <= classData.endTime) {
    return;
  }

  if (!['completed', 'cancelled'].includes(classData.status)) {
    classData.status = 'completed';
    classData.updatedAt = now;
    await classData.save();
  }
};

const createHttpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
};

const parseQrPayload = (rawValue, context) => {
  if (typeof rawValue === 'object' && rawValue !== null) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    try {
      return JSON.parse(rawValue);
    } catch (err) {
      throw createHttpError(
        400,
        'Invalid QR payload format',
        `${context}_invalid_qr_payload`
      );
    }
  }

  throw createHttpError(
    400,
    'QR payload is required',
    `${context}_missing_qr_payload`
  );
};

const ensureClassWithQr = async (classIdInput, qrValue, context, options = {}) => {
  const {
    allowAfterEnd = false,
    maxMinutesAfterEnd = DEFAULT_CHECKOUT_GRACE_MINUTES
  } = options;

  const validation = validateObjectId(classIdInput, { required: true, fieldName: 'Class ID' });
  if (!validation.valid) {
    throw createHttpError(400, validation.message, validation.error || 'invalid_class_id');
  }

  const classData = await Class.findById(validation.id);
  if (!classData) {
    throw createHttpError(404, 'Class not found', 'class_not_found');
  }

  const allowedStatuses = allowAfterEnd ? [...ALLOWED_CLASS_STATUSES, 'completed'] : ALLOWED_CLASS_STATUSES;

  if (!allowedStatuses.includes(classData.status)) {
    throw createHttpError(
      400,
      `Class status does not allow attendance tracking: ${classData.status}`,
      'invalid_class_status'
    );
  }

  if (!classData.qrCode?.value) {
    throw createHttpError(400, 'QR code has not been generated for this class', 'qr_not_available');
  }

  let storedPayload;
  try {
    storedPayload = JSON.parse(classData.qrCode.value);
  } catch (err) {
    throw createHttpError(500, 'Stored QR payload is corrupted', 'qr_storage_corrupted');
  }

  const incomingPayload = parseQrPayload(qrValue, context);

  if (incomingPayload.type !== 'class_check') {
    throw createHttpError(400, 'Invalid QR payload type', 'invalid_qr_type');
  }

  if (incomingPayload.classId !== classData._id.toString()) {
    throw createHttpError(400, 'QR code does not match this class', 'qr_class_mismatch');
  }

  if (incomingPayload.token !== storedPayload.token) {
    throw createHttpError(400, 'QR token is invalid or expired', 'qr_token_mismatch');
  }

  const now = new Date();
  const classEndTime = classData.endTime ? new Date(classData.endTime) : null;

  if (classEndTime && !Number.isNaN(classEndTime.getTime()) && now > classEndTime) {
    await markClassCompletedIfNeeded(classData, now);

    const diffMinutes = (now.getTime() - classEndTime.getTime()) / (1000 * 60);

    const withinGrace = allowAfterEnd && (
      maxMinutesAfterEnd === null || maxMinutesAfterEnd === undefined || diffMinutes <= maxMinutesAfterEnd
    );

    if (!withinGrace) {
      throw createHttpError(
        409,
        allowAfterEnd
          ? 'Class has ended and checkout window is closed'
          : 'Class has already ended, check-in is no longer allowed',
        allowAfterEnd ? 'class_checkout_window_closed' : 'class_already_ended'
      );
    }
  }

  return { classData, qrPayload: incomingPayload };
};

const loadUserWithRole = async (userId, expectedRole) => {
  const user = await User.findById(userId);
  if (!user) {
    throw createHttpError(401, 'User not found', 'user_not_found');
  }

  if (user.role !== expectedRole) {
    throw createHttpError(403, `User role must be ${expectedRole}`, 'forbidden');
  }

  if (!user.isActive) {
    throw createHttpError(403, 'User account is deactivated', 'account_deactivated');
  }

  return user;
};

const buildAttendanceResponse = (attendance, classData) => ({
  attendanceId: attendance._id,
  classId: classData._id,
  role: attendance.role,
  checkInAt: attendance.checkInAt,
  checkOutAt: attendance.checkOutAt
});

exports.staffCheckIn = async (req, res) => {
  const context = 'classAttendanceController.staffCheckIn';
  try {
    logDebug(context, 'PT check-in request received', {
      classId: req.params.classId,
      staffId: req.user.id
    });

    const staff = await loadUserWithRole(req.user.id, 'staff');
    const { qrValue } = req.body;
    if (!qrValue) {
      throw createHttpError(400, 'QR payload is required', 'missing_qr_payload');
    }

    const { classData, qrPayload } = await ensureClassWithQr(req.params.classId, qrValue, 'staff_check');

    if (classData.staffId.toString() !== staff._id.toString()) {
      throw createHttpError(403, 'You are not assigned to this class', 'staff_not_assigned');
    }

    let attendance = await ClassAttendance.findOne({
      classId: classData._id,
      userId: staff._id
    });

    if (attendance?.checkInAt) {
      throw createHttpError(409, 'Check-in already recorded for this class', 'duplicate_checkin');
    }

    if (!attendance) {
      attendance = new ClassAttendance({
        classId: classData._id,
        userId: staff._id,
        role: 'staff'
      });
    }

    attendance.checkInAt = new Date();
    attendance.checkInMethod = 'qr';
    attendance.checkInToken = qrPayload.token;
    await attendance.save();

    if (classData.status === 'scheduled') {
      classData.status = 'ongoing';
      classData.updatedAt = new Date();
      await classData.save();
    }

    logSuccess(context, 'PT check-in thành công', {
      classId: classData._id,
      staffId: staff._id,
      attendanceId: attendance._id
    });

    return res.status(200).json({
      success: true,
      message: 'Staff check-in recorded successfully',
      data: buildAttendanceResponse(attendance, classData)
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      logError(context, 'Lỗi khi PT check-in', error);
    } else {
      logWarning(context, error.message, {
        status,
        code: error.code
      });
    }

    return res.status(status).json({
      success: false,
      error: error.code || 'server_error',
      message: error.message || 'Failed to record staff check-in'
    });
  }
};

exports.staffCheckOut = async (req, res) => {
  const context = 'classAttendanceController.staffCheckOut';
  try {
    logDebug(context, 'PT check-out request received', {
      classId: req.params.classId,
      staffId: req.user.id
    });

    const staff = await loadUserWithRole(req.user.id, 'staff');
    const { qrValue } = req.body;
    if (!qrValue) {
      throw createHttpError(400, 'QR payload is required', 'missing_qr_payload');
    }

    const { classData, qrPayload } = await ensureClassWithQr(
      req.params.classId,
      qrValue,
      'staff_check',
      { allowAfterEnd: true, maxMinutesAfterEnd: DEFAULT_CHECKOUT_GRACE_MINUTES }
    );

    if (classData.staffId.toString() !== staff._id.toString()) {
      throw createHttpError(403, 'You are not assigned to this class', 'staff_not_assigned');
    }

    const attendance = await ClassAttendance.findOne({
      classId: classData._id,
      userId: staff._id
    });

    if (!attendance || !attendance.checkInAt) {
      throw createHttpError(400, 'Check-in must be recorded before check-out', 'missing_checkin');
    }

    if (attendance.checkOutAt) {
      throw createHttpError(409, 'Check-out already recorded for this class', 'duplicate_checkout');
    }

    attendance.checkOutAt = new Date();
    attendance.checkOutMethod = 'qr';
    attendance.checkOutToken = qrPayload.token;
    await attendance.save();

    logSuccess(context, 'PT check-out thành công', {
      classId: classData._id,
      staffId: staff._id,
      attendanceId: attendance._id
    });

    return res.status(200).json({
      success: true,
      message: 'Staff check-out recorded successfully',
      data: buildAttendanceResponse(attendance, classData)
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      logError(context, 'Lỗi khi PT check-out', error);
    } else {
      logWarning(context, error.message, {
        status,
        code: error.code
      });
    }

    return res.status(status).json({
      success: false,
      error: error.code || 'server_error',
      message: error.message || 'Failed to record staff check-out'
    });
  }
};

exports.customerCheckIn = async (req, res) => {
  const context = 'classAttendanceController.customerCheckIn';
  try {
    logDebug(context, 'Customer check-in request received', {
      classId: req.params.classId,
      customerId: req.user.id
    });

    const customer = await loadUserWithRole(req.user.id, 'customer');
    const { qrValue } = req.body;
    if (!qrValue) {
      throw createHttpError(400, 'QR payload is required', 'missing_qr_payload');
    }

    const { classData, qrPayload } = await ensureClassWithQr(req.params.classId, qrValue, 'customer_check');

    const enrollment = await Enrollment.findOne({
      userId: customer._id,
      classId: classData._id,
      status: { $in: ['active', 'completed'] }
    });

    if (!enrollment) {
      throw createHttpError(403, 'You are not enrolled in this class', 'not_enrolled');
    }

    let attendance = await ClassAttendance.findOne({
      classId: classData._id,
      userId: customer._id
    });

    if (attendance?.checkInAt) {
      throw createHttpError(409, 'Check-in already recorded for this class', 'duplicate_checkin');
    }

    if (!attendance) {
      attendance = new ClassAttendance({
        classId: classData._id,
        userId: customer._id,
        role: 'customer'
      });
    }

    attendance.checkInAt = new Date();
    attendance.checkInMethod = 'qr';
    attendance.checkInToken = qrPayload.token;
    await attendance.save();

    logSuccess(context, 'Customer check-in thành công', {
      classId: classData._id,
      customerId: customer._id,
      attendanceId: attendance._id
    });

    return res.status(200).json({
      success: true,
      message: 'Customer check-in recorded successfully',
      data: buildAttendanceResponse(attendance, classData)
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      logError(context, 'Lỗi khi customer check-in', error);
    } else {
      logWarning(context, error.message, {
        status,
        code: error.code
      });
    }

    return res.status(status).json({
      success: false,
      error: error.code || 'server_error',
      message: error.message || 'Failed to record customer check-in'
    });
  }
};

exports.customerCheckOut = async (req, res) => {
  const context = 'classAttendanceController.customerCheckOut';
  try {
    logDebug(context, 'Customer check-out request received', {
      classId: req.params.classId,
      customerId: req.user.id
    });

    const customer = await loadUserWithRole(req.user.id, 'customer');
    const { qrValue } = req.body;
    if (!qrValue) {
      throw createHttpError(400, 'QR payload is required', 'missing_qr_payload');
    }

    const { classData, qrPayload } = await ensureClassWithQr(
      req.params.classId,
      qrValue,
      'customer_check',
      { allowAfterEnd: true, maxMinutesAfterEnd: DEFAULT_CHECKOUT_GRACE_MINUTES }
    );

    const attendance = await ClassAttendance.findOne({
      classId: classData._id,
      userId: customer._id
    });

    if (!attendance || !attendance.checkInAt) {
      throw createHttpError(400, 'Check-in must be recorded before check-out', 'missing_checkin');
    }

    if (attendance.checkOutAt) {
      throw createHttpError(409, 'Check-out already recorded for this class', 'duplicate_checkout');
    }

    attendance.checkOutAt = new Date();
    attendance.checkOutMethod = 'qr';
    attendance.checkOutToken = qrPayload.token;
    await attendance.save();

    logSuccess(context, 'Customer check-out thành công', {
      classId: classData._id,
      customerId: customer._id,
      attendanceId: attendance._id
    });

    return res.status(200).json({
      success: true,
      message: 'Customer check-out recorded successfully',
      data: buildAttendanceResponse(attendance, classData)
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      logError(context, 'Lỗi khi customer check-out', error);
    } else {
      logWarning(context, error.message, {
        status,
        code: error.code
      });
    }

    return res.status(status).json({
      success: false,
      error: error.code || 'server_error',
      message: error.message || 'Failed to record customer check-out'
    });
  }
};
