// controllers/userController.js
const User = require('../models/User');
const { OtpServiceError } = require('../services/otpService');
const otpService = require('../services/otpService');
const { validateProfileUpdate, validateOtp } = require('../utils/validation');
const { logError, logSuccess, logWarning, logDebug, logUserAction } = require('../utils/logger');

/**
 * Handles OtpServiceError and sends an appropriate HTTP response.
 * @param {object} res - The Express response object.
 * @param {OtpServiceError} err - The error thrown by the OTP service.
 * @param {string} context - The controller function name for logging.
 */
function handleOtpError(res, err, context, phone) {
  logWarning(context, err.message, { code: err.code, phone });
  return res.status(err.statusCode).json({ 
    error: err.code,
    message: err.message 
  });
}

/**
 * Get current user profile
 */
exports.getProfile = async (req, res) => {
  const context = 'userController.getProfile';
  try {
    logDebug(context, `Lấy profile cho user: ${req.user.id}`);
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      logWarning(context, `Không tìm thấy user: ${req.user.id}`);
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    const profile = {
      id: user._id,
      phone: user.phone,
      name: user.name || null,
      email: user.email || null,
      avatarUrl: user.avatarUrl || null,
      gender: user.gender || null,
      dob: user.dob || null,
      weight: user.weight || null,
      height: user.height || null,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };

    logSuccess(context, `Lấy profile thành công: ${user.phone}`);
    return res.json({ ok: true, user: profile });

  } catch (err) {
    logError(context, 'Lỗi khi lấy profile', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to get profile' });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  const context = 'userController.updateProfile';
  try {
    logDebug(context, `Cập nhật profile cho user: ${req.user.id}`, { updates: req.body });

    const validation = validateProfileUpdate(req.body);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      logWarning(context, 'Validation thất bại', { field: Object.keys(validation.errors)[0], error: firstError });
      return res.status(400).json({ error: firstError.error, message: firstError.message });
    }

    if (Object.keys(validation.data).length === 0) {
      return res.status(400).json({ error: 'no_updates', message: 'No valid fields provided for update' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, validation.data, { new: true, runValidators: true });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    logSuccess(context, `Cập nhật profile thành công: ${user.phone}`, { updatedFields: Object.keys(validation.data) });
    logUserAction(user._id, 'Cập nhật profile', { fields: Object.keys(validation.data) });

    return res.json({ 
      ok: true, 
      message: 'Profile updated successfully', 
      user: { /* return updated fields */ }
    });

  } catch (err) {
    logError(context, 'Lỗi khi cập nhật profile', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update profile' });
  }
};

/**
 * Step 1: Request to delete a user account by sending an OTP.
 */
exports.requestDeleteAccount = async (req, res) => {
  const context = 'userController.requestDeleteAccount';
  let phone;
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }
    phone = user.phone;

    logWarning(context, `⚠️ Yêu cầu XÓA TÀI KHOẢN từ: ${phone}`);
    const result = await otpService.requestOtp(phone, 'delete_account', req.ip);
    
    return res.json(result);

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(res, err, context, phone);
    }
    logError(context, 'Lỗi không xác định khi gửi OTP xóa tài khoản', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to request account deletion' });
  }
};

/**
 * Step 2: Confirm account deletion with OTP.
 */
exports.confirmDeleteAccount = async (req, res) => {
  const context = 'userController.confirmDeleteAccount';
  let user;
  try {
    const otpValidation = validateOtp(req.body.code);
    if (!otpValidation.valid) {
      return res.status(400).json({ error: otpValidation.error, message: otpValidation.message });
    }
    const otp = otpValidation.otp;

    user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    logWarning(context, `⚠️ ĐỌC XÁC NHẬN XÓA TÀI KHOẢN từ: ${user.phone}`);

    const isVerified = await otpService.verifyOtp(user.phone, otp, 'delete_account');

    if (isVerified) {
      const userId = user._id;
      const userPhone = user.phone;

      // Permanently delete the user
      await User.findByIdAndDelete(userId);
      
      // Optional: Clean up all OTP logs for this user
      const OtpLog = require('../models/OtpLog');
      await OtpLog.deleteMany({ phone: userPhone });

      logWarning(context, `🗑️ XÓA VĨNH VIỄN TÀI KHOẢN: ${userPhone} | User ID: ${userId}`);
      logUserAction(userId, 'XÓA TÀI KHOẢN VĨNH VIỄN', { phone: userPhone });

      return res.json({ ok: true, message: 'Account deleted successfully' });
    }

    return res.status(400).json({ error: 'invalid_otp', message: 'Invalid OTP code.' });

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(res, err, context, user?.phone);
    }
    logError(context, 'Lỗi không xác định khi xác thực OTP xóa tài khoản', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to delete account' });
  }
};