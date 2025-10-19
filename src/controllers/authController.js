
// controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OtpServiceError } = require('../services/otpService');
const otpService = require('../services/otpService');
const { validatePhone, validateOtp } = require('../utils/validation');
const { logError, logSuccess, logWarning, logDebug, logAuth } = require('../utils/logger');

const { JWT_SECRET, JWT_EXPIRES_IN = '12h' } = process.env;

/**
 * Handles OtpServiceError and sends an appropriate HTTP response.
 * @param {object} res - The Express response object.
 * @param {OtpServiceError} err - The error thrown by the OTP service.
 * @param {string} context - The controller function name for logging.
 */
function handleOtpError(req, res, err, context) {
  // Use safe access to request body for logging
  const phone = req && req.body ? req.body.phone : undefined;
  logWarning(context, err.message, { code: err.code, phone });
  return res.status(err.statusCode || 500).json({ 
    error: err.code || 'esms_error',
    message: err.message || 'OTP service error' 
  });
}

/**
 * Generate JWT token
 */
function generateToken(user) {
  if (!JWT_SECRET) {
    logError('generateToken', 'JWT_SECRET is not configured');
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { userId: user._id, phone: user.phone },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Register: Send OTP for new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  const context = 'authController.register';
  try {
    logDebug(context, 'Bắt đầu xử lý đăng ký', { body: req.body });

    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error, message: phoneValidation.message });
    }
    const phone = phoneValidation.phone;

    const existingUser = await User.findOne({ phone });
    if (existingUser && existingUser.isVerified) {
      logWarning(context, `Số điện thoại đã đăng ký: ${phone}`);
      return res.status(400).json({ 
        error: 'phone_already_registered',
        message: 'Phone number already registered. Please login instead.' 
      });
    }

    const result = await otpService.requestOtp(phone, 'register', req.ip);
    return res.json(result);

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(req, res, err, context);
    }
    logError(context, 'Lỗi không xác định khi gửi OTP', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to send OTP. Please try again.' });
  }
};

/**
 * Verify Registration OTP and create user
 * POST /api/auth/verify-register
 */
exports.verifyRegister = async (req, res) => {
  const context = 'authController.verifyRegister';
  try {
    logDebug(context, 'Bắt đầu xác thực OTP đăng ký', { body: req.body });

    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error, message: phoneValidation.message });
    }

    const otpValidation = validateOtp(req.body.code);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error, message: otpValidation.message });
    }

    const phone = phoneValidation.phone;
    const code = otpValidation.otp;

    const isVerified = await otpService.verifyOtp(phone, code, 'register');

    if (isVerified) {
      let user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({ phone, isVerified: true });
        logSuccess(context, `Tạo user mới: ${phone}`, { userId: user._id });
      } else {
        user.isVerified = true;
        await user.save();
        logSuccess(context, `Cập nhật user đã có: ${phone}`, { userId: user._id });
      }

      const token = generateToken(user);
      logAuth('Đăng ký thành công', phone, true);

      return res.json({
        ok: true,
        message: 'Registration successful',
        token,
        user: { id: user._id, phone: user.phone, isVerified: user.isVerified, createdAt: user.createdAt }
      });
    }
    // If verifyOtp throws an error, the catch block will handle it.
    // If it returns false (which it shouldn't with the new logic, it throws instead), we can add a fallback.
    return res.status(400).json({ error: 'invalid_otp', message: 'Invalid OTP code.' });

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(req, res, err, context);
    }
    logError(context, 'Lỗi không xác định khi xác thực OTP', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to verify OTP. Please try again.' });
  }
};

/**
 * Login: Send OTP for existing verified user
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  const context = 'authController.login';
  try {
    logDebug(context, 'Bắt đầu xử lý đăng nhập', { body: req.body });

    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error, message: phoneValidation.message });
    }
    const phone = phoneValidation.phone;

    const existingUser = await User.findOne({ phone });
    if (!existingUser || !existingUser.isVerified) {
      logWarning(context, `Tài khoản không tồn tại hoặc chưa xác thực: ${phone}`);
      return res.status(404).json({ 
        error: 'user_not_found_or_unverified', 
        message: 'Account not found or not verified. Please sign up first.' 
      });
    }

    const result = await otpService.requestOtp(phone, 'login', req.ip);
    return res.json(result);

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(req, res, err, context);
    }
    logError(context, 'Lỗi không xác định khi gửi OTP đăng nhập', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to send login OTP.' });
  }
};

/**
 * Verify login OTP
 * POST /api/auth/verify-login
 */
exports.verifyLogin = async (req, res) => {
  const context = 'authController.verifyLogin';
  try {
    logDebug(context, 'Bắt đầu xác thực OTP đăng nhập', { body: req.body });

    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error, message: phoneValidation.message });
    }

    const otpValidation = validateOtp(req.body.code);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error, message: otpValidation.message });
    }

    const phone = phoneValidation.phone;
    const code = otpValidation.otp;

    const user = await User.findOne({ phone });
    if (!user || !user.isVerified) {
      logWarning(context, `User không tồn tại hoặc chưa xác thực: ${phone}`);
      return res.status(404).json({ error: 'user_not_found', message: 'User not found or not verified' });
    }

    const isVerified = await otpService.verifyOtp(phone, code, 'login');

    if (isVerified) {
      const token = generateToken(user);
      logAuth('Đăng nhập thành công', phone, true);

      return res.json({
        ok: true,
        message: 'Login successful',
        token,
        user: { id: user._id, phone: user.phone, createdAt: user.createdAt }
      });
    }
    
    return res.status(400).json({ error: 'invalid_otp', message: 'Invalid OTP code.' });

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(req, res, err, context);
    }
    logError(context, 'Lỗi không xác định khi xác thực OTP đăng nhập', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to verify login OTP.' });
  }
};
