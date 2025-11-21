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
const {
  updateClassLifecycleStatus
} = require('../services/classStatusService');

// Allow a short post-class window for check-out scans (minutes).
const rawGraceMinutes = parseInt(process.env.CLASS_CHECKOUT_GRACE_MINUTES || '15', 10);
const DEFAULT_CHECKOUT_GRACE_MINUTES = Number.isFinite(rawGraceMinutes) && rawGraceMinutes >= 0
  ? rawGraceMinutes
  : 15;

const rawCheckInGraceMinutes = parseInt(process.env.CLASS_CHECKIN_GRACE_MINUTES || '15', 10);
const DEFAULT_CHECKIN_GRACE_MINUTES = Number.isFinite(rawCheckInGraceMinutes) && rawCheckInGraceMinutes >= 0
  ? rawCheckInGraceMinutes
  : 15;

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

const calculateCheckInWindowStart = (classData, graceMinutes = DEFAULT_CHECKIN_GRACE_MINUTES) => {
  if (!classData?.startTime) {
    return null;
  }

  const windowStart = new Date(classData.startTime);
  windowStart.setMinutes(windowStart.getMinutes() - graceMinutes);
  return windowStart;
};

const promoteClassToWaitingPtIfNeeded = async (
  classData,
  now = new Date(),
  options = {}
) => {
  if (!classData) {
    return null;
  }

  const {
    allowedStatuses = [],
    checkInGraceMinutes = DEFAULT_CHECKIN_GRACE_MINUTES
  } = options;

  const effectiveAllowedStatuses = allowedStatuses.length > 0
    ? allowedStatuses
    : ['scheduled', 'waiting_pt'];

  if (
    classData.status !== 'scheduled' ||
    !effectiveAllowedStatuses.includes('waiting_pt')
  ) {
    return classData;
  }

  const windowStart = calculateCheckInWindowStart(classData, checkInGraceMinutes);
  if (!windowStart || now < windowStart) {
    return classData;
  }

  classData.status = 'waiting_pt';
  classData.updatedAt = now;
  await classData.save();

  logDebug(
    'classAttendanceController.promoteClassToWaitingPtIfNeeded',
    'Class promoted to waiting_pt as check-in window opened',
    {
      classId: classData._id,
      previousStatus: 'scheduled',
      updatedAt: now.toISOString()
    }
  );

  return classData;
};

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateOffsetMinutes = (timestamp, reference) => {
  if (!timestamp || !reference) return 0;
  return Math.round((timestamp.getTime() - reference.getTime()) / (1000 * 60));
};

const applyCheckInMetrics = (attendance, classData, timestamp) => {
  const startTime = toDate(classData.startTime);
  const offset = calculateOffsetMinutes(timestamp, startTime);
  attendance.checkInOffsetMinutes = offset;
  attendance.isLateCheckIn = offset > 0;
};

const applyCheckOutMetrics = (attendance, classData, timestamp) => {
  const endTime = toDate(classData.endTime);
  const offset = calculateOffsetMinutes(timestamp, endTime);
  attendance.checkOutOffsetMinutes = offset;
  attendance.isEarlyCheckOut = offset < 0;
};

const ensureClassWithQr = async (classIdInput, qrValue, context, options = {}) => {
  const {
    allowAfterEnd = false,
    maxMinutesAfterEnd = DEFAULT_CHECKOUT_GRACE_MINUTES,
    allowedStatuses,
    enforceCheckInWindow = false,
    checkInGraceMinutes = DEFAULT_CHECKIN_GRACE_MINUTES
  } = options;

  const validation = validateObjectId(classIdInput, { required: true, fieldName: 'Class ID' });
  if (!validation.valid) {
    throw createHttpError(400, validation.message, validation.error || 'invalid_class_id');
  }

  const classData = await Class.findById(validation.id);
  if (!classData) {
    throw createHttpError(404, 'Class not found', 'class_not_found');
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

  if (enforceCheckInWindow) {
    const windowStart = calculateCheckInWindowStart(classData, checkInGraceMinutes);
    if (windowStart && now < windowStart) {
      throw createHttpError(
        409,
        'Check-in is only allowed within the pre-defined time window before class start',
        'checkin_window_not_started'
      );
    }

    await promoteClassToWaitingPtIfNeeded(classData, now, { allowedStatuses: allowedStatuses || [] });
  }

  const resolvedAllowedStatuses = allowedStatuses
    ? allowedStatuses
    : allowAfterEnd
      ? ['on_going_waiting_customers', 'on_going', 'waiting_checkout', 'overdue', 'completed']
      : ['scheduled', 'waiting_pt', 'on_going_waiting_customers', 'on_going'];

  if (!resolvedAllowedStatuses.includes(classData.status)) {
    throw createHttpError(
      400,
      `Class status does not allow attendance tracking: ${classData.status}`,
      'invalid_class_status'
    );
  }

  const classEndTime = classData.endTime ? new Date(classData.endTime) : null;

  if (classEndTime && !Number.isNaN(classEndTime.getTime()) && now > classEndTime) {
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

  return { classData, qrPayload: incomingPayload, now };
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

    const { classData, qrPayload, now } = await ensureClassWithQr(
      req.params.classId,
      qrValue,
      'staff_check',
      {
        allowedStatuses: ['scheduled', 'waiting_pt'],
        enforceCheckInWindow: true
      }
    );

    if (classData.staffId.toString() !== staff._id.toString()) {
      throw createHttpError(403, 'You are not assigned to this class', 'staff_not_assigned');
    }

    let attendance = await ClassAttendance.findOne({
      classId: classData._id,
      userId: staff._id
    });

    if (attendance?.checkInAt) {
      logDebug(context, 'PT attempted to re-scan for check-in; keeping first timestamp', {
        classId: classData._id,
        staffId: staff._id,
        originalCheckInAt: attendance.checkInAt
      });

      return res.status(200).json({
        success: true,
        message: 'Staff already checked in earlier; using first scan timestamp',
        data: buildAttendanceResponse(attendance, classData)
      });
    }

    if (!attendance) {
      attendance = new ClassAttendance({
        classId: classData._id,
        userId: staff._id,
        role: 'staff'
      });
    }

    attendance.checkInAt = now;
    attendance.checkInMethod = 'qr';
    attendance.checkInToken = qrPayload.token;
    applyCheckInMetrics(attendance, classData, now);
    await attendance.save();

    const updatedStatus = await updateClassLifecycleStatus(classData._id, now);
    if (updatedStatus) {
      classData.status = updatedStatus;
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

    const { classData, qrPayload, now } = await ensureClassWithQr(
      req.params.classId,
      qrValue,
      'staff_check',
      {
        allowAfterEnd: true,
        maxMinutesAfterEnd: DEFAULT_CHECKOUT_GRACE_MINUTES,
        allowedStatuses: ['on_going', 'waiting_checkout', 'overdue'],
        enforceCheckInWindow: false
      }
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

    const hadPreviousCheckOut = Boolean(attendance.checkOutAt);
    const previousCheckOutAt = attendance.checkOutAt;

    attendance.checkOutAt = now;
    attendance.checkOutMethod = 'qr';
    attendance.checkOutToken = qrPayload.token;
    applyCheckOutMetrics(attendance, classData, now);
    await attendance.save();

    const updatedStatus = await updateClassLifecycleStatus(classData._id, now);
    if (updatedStatus) {
      classData.status = updatedStatus;
    }

    logSuccess(
      context,
      hadPreviousCheckOut
        ? 'PT check-out timestamp updated with latest scan'
        : 'PT check-out thành công',
      {
        classId: classData._id,
        staffId: staff._id,
        attendanceId: attendance._id,
        previousCheckOutAt
      }
    );

    return res.status(200).json({
      success: true,
      message: hadPreviousCheckOut
        ? 'Staff check-out updated to latest scan timestamp'
        : 'Staff check-out recorded successfully',
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

    const { classData, qrPayload, now } = await ensureClassWithQr(
      req.params.classId,
      qrValue,
      'customer_check',
      {
        allowedStatuses: ['scheduled', 'waiting_pt', 'on_going_waiting_customers', 'on_going'],
        enforceCheckInWindow: true
      }
    );

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
      logDebug(context, 'Customer attempted to re-scan for check-in; keeping first scan timestamp', {
        classId: classData._id,
        customerId: customer._id,
        originalCheckInAt: attendance.checkInAt
      });

      return res.status(200).json({
        success: true,
        message: 'Customer already checked in earlier; using first scan timestamp',
        data: buildAttendanceResponse(attendance, classData)
      });
    }

    if (!attendance) {
      attendance = new ClassAttendance({
        classId: classData._id,
        userId: customer._id,
        role: 'customer'
      });
    }

    attendance.checkInAt = now;
    attendance.checkInMethod = 'qr';
    attendance.checkInToken = qrPayload.token;
    applyCheckInMetrics(attendance, classData, now);
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

    const { classData, qrPayload, now } = await ensureClassWithQr(
      req.params.classId,
      qrValue,
      'customer_check',
      {
        allowAfterEnd: true,
        maxMinutesAfterEnd: DEFAULT_CHECKOUT_GRACE_MINUTES,
        allowedStatuses: ['on_going', 'waiting_checkout', 'overdue']
      }
    );

    const attendance = await ClassAttendance.findOne({
      classId: classData._id,
      userId: customer._id
    });

    if (!attendance || !attendance.checkInAt) {
      throw createHttpError(400, 'Check-in must be recorded before check-out', 'missing_checkin');
    }

    const hadPreviousCheckOut = Boolean(attendance.checkOutAt);
    const previousCheckOutAt = attendance.checkOutAt;

    attendance.checkOutAt = now;
    attendance.checkOutMethod = 'qr';
    attendance.checkOutToken = qrPayload.token;
    applyCheckOutMetrics(attendance, classData, now);
    await attendance.save();

    const updatedStatus = await updateClassLifecycleStatus(classData._id, now);
    if (updatedStatus) {
      classData.status = updatedStatus;
    }

    logSuccess(
      context,
      hadPreviousCheckOut ? 'Customer check-out timestamp updated with latest scan' : 'Customer check-out thành công',
      {
        classId: classData._id,
        customerId: customer._id,
        attendanceId: attendance._id,
        previousCheckOutAt
      }
    );

    return res.status(200).json({
      success: true,
      message: hadPreviousCheckOut
        ? 'Customer check-out updated to latest scan timestamp'
        : 'Customer check-out recorded successfully',
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

exports.customerAttendanceScan = async (req, res) => {
  const context = 'classAttendanceController.customerAttendanceScan';
  try {
    const validation = validateObjectId(req.params.classId, {
      required: true,
      fieldName: 'Class ID'
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'invalid_class_id',
        message: validation.message
      });
    }

    const attendance = await ClassAttendance.findOne({
      classId: validation.id,
      userId: req.user.id
    });

    if (!attendance || !attendance.checkInAt) {
      logDebug(context, 'Delegating scan to customer check-in handler', {
        classId: validation.id,
        customerId: req.user.id
      });
      return exports.customerCheckIn(req, res);
    }

    logDebug(context, 'Delegating scan to customer check-out handler', {
      classId: validation.id,
      customerId: req.user.id,
      checkInAt: attendance.checkInAt,
      previousCheckOutAt: attendance.checkOutAt
    });
    return exports.customerCheckOut(req, res);
  } catch (error) {
    logError(context, 'Lỗi khi xử lý customer attendance scan', error);
    return res.status(500).json({
      success: false,
      error: error.code || 'server_error',
      message: error.message || 'Failed to record attendance scan'
    });
  }
};

exports.staffAttendanceScan = async (req, res) => {
  const context = 'classAttendanceController.staffAttendanceScan';
  try {
    const validation = validateObjectId(req.params.classId, {
      required: true,
      fieldName: 'Class ID'
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'invalid_class_id',
        message: validation.message
      });
    }

    const attendance = await ClassAttendance.findOne({
      classId: validation.id,
      userId: req.user.id
    });

    if (!attendance || !attendance.checkInAt) {
      logDebug(context, 'Delegating scan to staff check-in handler', {
        classId: validation.id,
        staffId: req.user.id
      });
      return exports.staffCheckIn(req, res);
    }

    logDebug(context, 'Delegating scan to staff check-out handler', {
      classId: validation.id,
      staffId: req.user.id,
      checkInAt: attendance.checkInAt,
      previousCheckOutAt: attendance.checkOutAt
    });
    return exports.staffCheckOut(req, res);
  } catch (error) {
    logError(context, 'Lỗi khi xử lý staff attendance scan', error);
    return res.status(500).json({
      success: false,
      error: error.code || 'server_error',
      message: error.message || 'Failed to record staff attendance scan'
    });
  }
};
