// controllers/staffAuthController.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpService = require('../services/otpService');
const { OtpServiceError } = require('../services/otpService');
const { validatePhone, validateOtp } = require('../utils/validation');
const { logError, logSuccess, logWarning, logDebug, logAuth } = require('../utils/logger');

const { JWT_SECRET, JWT_EXPIRES_IN = '12h' } = process.env;

const PURPOSE_TYPE_MAP = {
  first_login: 'staff_first_login',
  login: 'staff_login'
};

function handleOtpError(req, res, err, context) {
  const phone = req?.body?.phone;
  logWarning(context, err.message, { code: err.code, phone });
  return res.status(err.statusCode || 500).json({
    error: err.code || 'otp_error',
    message: err.message || 'OTP service error'
  });
}

function validatePurpose(purpose) {
  if (!purpose) {
    return { valid: false, error: 'missing_purpose', message: 'Purpose is required' };
  }

  const normalized = String(purpose).toLowerCase();
  if (!PURPOSE_TYPE_MAP[normalized]) {
    return {
      valid: false,
      error: 'invalid_purpose',
      message: 'Purpose must be one of: first_login, login'
    };
  }

  return { valid: true, purpose: normalized, otpType: PURPOSE_TYPE_MAP[normalized] };
}

function generateToken(user) {
  if (!JWT_SECRET) {
    logError('staffAuthController.generateToken', 'JWT_SECRET is not configured');
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(
    { userId: user._id, phone: user.phone },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function findStaffByPhone(phone) {
  return User.findOne({ phone }).select('_id phone role isActive isVerified name');
}

exports.requestOtp = async (req, res) => {
  const context = 'staffAuthController.requestOtp';

  try {
    logDebug(context, 'Bắt đầu gửi OTP cho staff', { body: req.body });

    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error, message: phoneValidation.message });
    }

    const purposeValidation = validatePurpose(req.body.purpose);
    if (!purposeValidation.valid) {
      return res.status(400).json({ error: purposeValidation.error, message: purposeValidation.message });
    }

    const phone = phoneValidation.phone;
    const { purpose, otpType } = purposeValidation;

    const staff = await findStaffByPhone(phone);

    if (!staff || staff.role !== 'staff') {
      logWarning(context, `Không tìm thấy staff với số điện thoại: ${phone}`);
      return res.status(404).json({
        error: 'staff_not_found',
        message: 'Staff account not found'
      });
    }

    if (!staff.isActive) {
      logWarning(context, `Tài khoản staff đang bị vô hiệu hóa: ${phone}`);
      return res.status(403).json({
        error: 'account_deactivated',
        message: 'Staff account is deactivated. Please contact admin.'
      });
    }

    if (purpose === 'first_login' && staff.isVerified) {
      return res.status(400).json({
        error: 'already_verified',
        message: 'Staff account already verified. Please login instead.'
      });
    }

    if (purpose === 'login' && !staff.isVerified) {
      return res.status(403).json({
        error: 'staff_not_verified',
        message: 'Staff account is not verified yet. Please complete first login verification.'
      });
    }

    const otpResult = await otpService.requestOtp(phone, otpType, req.ip);

    logSuccess(context, `Gửi OTP ${purpose} cho staff thành công: ${phone}`);

    return res.json({
      ok: true,
      message: otpResult.message,
      sessionId: otpResult.sessionId,
      expiresIn: otpResult.expiresIn,
      dev_otp: otpResult.dev_otp,
      purpose,
      staff: {
        id: staff._id,
        phone: staff.phone,
        isVerified: staff.isVerified,
        isActive: staff.isActive
      }
    });
  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(req, res, err, context);
    }

    logError(context, 'Lỗi khi gửi OTP cho staff', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to send staff OTP. Please try again.'
    });
  }
};

exports.verifyOtp = async (req, res) => {
  const context = 'staffAuthController.verifyOtp';

  try {
    logDebug(context, 'Bắt đầu xác thực OTP staff', { body: req.body });

    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error, message: phoneValidation.message });
    }

    const otpValidation = validateOtp(req.body.code);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error, message: otpValidation.message });
    }

    const purposeValidation = validatePurpose(req.body.purpose);
    if (!purposeValidation.valid) {
      return res.status(400).json({ error: purposeValidation.error, message: purposeValidation.message });
    }

    const phone = phoneValidation.phone;
    const code = otpValidation.otp;
    const { purpose, otpType } = purposeValidation;

    const staff = await findStaffByPhone(phone);

    if (!staff || staff.role !== 'staff') {
      logWarning(context, `Không tìm thấy staff với số điện thoại: ${phone}`);
      return res.status(404).json({
        error: 'staff_not_found',
        message: 'Staff account not found'
      });
    }

    if (!staff.isActive) {
      logWarning(context, `Staff bị vô hiệu hóa cố gắng xác thực: ${phone}`);
      return res.status(403).json({
        error: 'account_deactivated',
        message: 'Staff account is deactivated. Please contact admin.'
      });
    }

    if (purpose === 'first_login' && staff.isVerified) {
      return res.status(400).json({
        error: 'already_verified',
        message: 'Staff account already verified. Please login instead.'
      });
    }

    if (purpose === 'login' && !staff.isVerified) {
      return res.status(403).json({
        error: 'staff_not_verified',
        message: 'Staff account is not verified yet. Please complete first login verification.'
      });
    }

    await otpService.verifyOtp(phone, code, otpType);

    if (purpose === 'first_login' && !staff.isVerified) {
      staff.isVerified = true;
      await staff.save();
      logSuccess(context, `Đánh dấu staff đã verify lần đầu: ${phone}`);
    }

    const token = generateToken(staff);

    logAuth(`Staff ${purpose} login`, phone, true);

    return res.json({
      ok: true,
      message: purpose === 'first_login' ? 'First login verified successfully' : 'Staff login successful',
      token,
      user: {
        id: staff._id,
        phone: staff.phone,
        role: staff.role,
        isVerified: staff.isVerified,
        isActive: staff.isActive,
        name: staff.name
      }
    });
  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(req, res, err, context);
    }

    logError(context, 'Lỗi khi xác thực OTP staff', err);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to verify staff OTP. Please try again.'
    });
  }
};
