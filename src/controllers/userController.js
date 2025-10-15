// controllers/userController.js
const { validateProfileUpdate, validateOtp } = require('../utils/validation');
const { logError, logSuccess, logWarning, logDebug, logUserAction, logOTP, logInfo, logRateLimit } = require('../utils/logger');

/**
 * Get current user profile
 * Protected route - requires JWT token
 * GET /api/user/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const User = require('../models/User');
    
    logDebug('userController.getProfile', `Lấy profile cho user: ${req.user.id}`);
    
    const user = await User.findById(req.user.id).lean();
    
    if (!user) {
      logWarning('userController.getProfile', `Không tìm thấy user: ${req.user.id}`);
      return res.status(404).json({ 
        error: 'user_not_found',
        message: 'User not found' 
      });
    }

    // Return only safe fields
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

    logSuccess('userController.getProfile', `Lấy profile thành công: ${user.phone}`);
    return res.json({ ok: true, user: profile });
    
  } catch (err) {
    logError('userController.getProfile', 'Lỗi khi lấy profile', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to get profile' 
    });
  }
};

/**
 * Update user profile
 * Protected route - requires JWT token
 * PUT /api/user/profile
 * Can update any field independently - all fields optional
 */
exports.updateProfile = async (req, res) => {
  try {
    const User = require('../models/User');
    
    logDebug('userController.updateProfile', `Cập nhật profile cho user: ${req.user.id}`, { updates: req.body });
    
    // Validate all fields using centralized validation
    const validation = validateProfileUpdate(req.body);
    
    // If validation failed, return first error
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      logWarning('userController.updateProfile', 'Validation thất bại', { 
        field: Object.keys(validation.errors)[0],
        error: firstError 
      });
      return res.status(400).json({
        error: firstError.error,
        message: firstError.message
      });
    }
    
    // Check if at least one field is being updated
    if (Object.keys(validation.data).length === 0) {
      logWarning('userController.updateProfile', 'Không có field nào để cập nhật');
      return res.status(400).json({ 
        error: 'no_updates', 
        message: 'No valid fields provided for update' 
      });
    }
    
    logInfo('userController.updateProfile', `Cập nhật ${Object.keys(validation.data).length} fields`, { 
      fields: Object.keys(validation.data) 
    });
    
    // Update user with validated data
    const user = await User.findByIdAndUpdate(
      req.user.id,
      validation.data,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      logWarning('userController.updateProfile', `Không tìm thấy user: ${req.user.id}`);
      return res.status(404).json({ 
        error: 'user_not_found',
        message: 'User not found' 
      });
    }

    logSuccess('userController.updateProfile', `Cập nhật profile thành công: ${user.phone}`, {
      userId: user._id,
      updatedFields: Object.keys(validation.data)
    });
    
    logUserAction(user._id, 'Cập nhật profile', { fields: Object.keys(validation.data) });

    return res.json({ 
      ok: true, 
      message: 'Profile updated successfully', 
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        gender: user.gender,
        dob: user.dob,
        weight: user.weight,
        height: user.height,
        updatedAt: user.updatedAt
      }
    });
    
  } catch (err) {
    logError('userController.updateProfile', 'Lỗi khi cập nhật profile', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to update profile' 
    });
  }
};

/**
 * Delete user account (PERMANENT)
 * Protected route - requires JWT token
 * Requires OTP verification for security
 * 
 * Steps:
 * 1. User requests deletion → sends OTP to phone
 * 2. User confirms with OTP → account deleted permanently
 */
exports.requestDeleteAccount = async (req, res) => {
  try {
    const User = require('../models/User');
    const OtpLog = require('../models/OtpLog');
    const axios = require('axios');

    const user = await User.findById(req.user.id);
    if (!user) {
      logWarning('userController.requestDeleteAccount', `Không tìm thấy user: ${req.user.id}`);
      return res.status(404).json({ 
        error: 'user_not_found', 
        message: 'User not found' 
      });
    }

    const phone = user.phone;
    logWarning('userController.requestDeleteAccount', `⚠️ Yêu cầu XÓA TÀI KHOẢN từ: ${phone}`);

    // Check rate limiting
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOtps = await OtpLog.countDocuments({
      phone,
      type: 'delete_account',
      createdAt: { $gte: oneHourAgo }
    });

    const maxOtpsPerHour = parseInt(process.env.MAX_OTPS_PER_HOUR) || 10;
    if (recentOtps >= maxOtpsPerHour) {
      logRateLimit(phone, '/api/user/account/delete/request', maxOtpsPerHour - recentOtps);
      return res.status(429).json({ 
        error: 'rate_limit_exceeded', 
        message: `Too many OTP requests. Max ${maxOtpsPerHour} per hour.` 
      });
    }

    // Check cooldown
    const cooldownSeconds = parseInt(process.env.RESEND_COOLDOWN_SECONDS) || 60;
    const cooldownAgo = new Date(Date.now() - cooldownSeconds * 1000);
    const recentOtp = await OtpLog.findOne({
      phone,
      type: 'delete_account',
      createdAt: { $gte: cooldownAgo }
    });

    if (recentOtp) {
      const waitTime = Math.ceil((cooldownSeconds * 1000 - (Date.now() - recentOtp.createdAt.getTime())) / 1000);
      logWarning('userController.requestDeleteAccount', `Cooldown chưa hết: ${phone} (còn ${waitTime}s)`);
      return res.status(429).json({ 
        error: 'cooldown_active', 
        message: `Please wait ${waitTime} seconds before requesting another OTP.` 
      });
    }

    // Sandbox mode
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await OtpLog.create({
        phone,
        type: 'delete_account',
        sessionId: 'sandbox-delete-' + Date.now(),
        expiresAt,
        status: 'pending'
      });

      logOTP('Gửi OTP xóa tài khoản (Sandbox)', phone, mockCode, expiresAt);

      return res.json({
        ok: true,
        message: 'OTP sent to your phone (sandbox mode)',
        dev_otp: mockCode,
        expiresIn: 600
      });
    }

    // Production: Send real OTP via eSMS
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;
    const brandName = process.env.ESMS_BRANDNAME || 'Baotrixemay';

    if (!apiKey || !secretKey) {
      logError('userController.requestDeleteAccount', 'Cấu hình eSMS chưa đầy đủ');
      return res.status(500).json({ 
        error: 'esms_config_missing', 
        message: 'eSMS not configured' 
      });
    }

    logInfo('userController.requestDeleteAccount', `Gửi OTP xóa tài khoản qua eSMS cho: ${phone}`);

    const sendUrl = 'https://rest.esms.vn/MainService.svc/json/SendMessageAutoGenCode_V4_get';
    const response = await axios.get(sendUrl, {
      params: {
        ApiKey: apiKey,
        SecretKey: secretKey,
        Phone: phone,
        Content: `Ma xac nhan xoa tai khoan cua ban`,
        Brandname: brandName,
        SmsType: 8
      }
    });

    if (response.data.CodeResult !== '100') {
      logError('userController.requestDeleteAccount', 'eSMS API trả về lỗi', response.data);
      return res.status(500).json({ 
        error: 'sms_send_failed', 
        message: 'Failed to send OTP' 
      });
    }

    const sessionId = response.data.SMSID;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OtpLog.create({
      phone,
      type: 'delete_account',
      sessionId,
      expiresAt,
      status: 'pending'
    });

    logSuccess('userController.requestDeleteAccount', `Gửi OTP xóa tài khoản thành công: ${phone}`, { sessionId });

    return res.json({
      ok: true,
      message: 'OTP sent to your phone to confirm account deletion',
      sessionId,
      expiresIn: 600
    });

  } catch (err) {
    logError('userController.requestDeleteAccount', 'Lỗi không xác định khi gửi OTP xóa tài khoản', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to request account deletion' 
    });
  }
};

/**
 * Confirm delete account with OTP
 * Protected route - requires JWT token
 * PERMANENTLY deletes user account and all related data
 */
exports.confirmDeleteAccount = async (req, res) => {
  try {
    const User = require('../models/User');
    const OtpLog = require('../models/OtpLog');
    const axios = require('axios');

    logDebug('userController.confirmDeleteAccount', `Xác nhận xóa tài khoản: ${req.user.id}`);

    // Validate OTP (accept both 'code' and 'otp' field names)
    const otpValidation = validateOtp(req.body.otp || req.body.code);
    if (!otpValidation.valid) {
      logWarning('userController.confirmDeleteAccount', `OTP không hợp lệ: ${req.body.otp || req.body.code}`);
      return res.status(400).json({ 
        error: otpValidation.error,
        message: otpValidation.message 
      });
    }

    const otp = otpValidation.otp;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        error: 'not_found', 
        message: 'User not found' 
      });
    }

    const phone = user.phone;

    logWarning('userController.confirmDeleteAccount', `⚠️ ĐỌC XÁC NHẬN XÓA TÀI KHOẢN từ: ${phone}`);

    // Find latest pending OTP
    const lastLog = await OtpLog.findOne({ 
      phone, 
      type: 'delete_account',
      status: 'pending' 
    }).sort({ createdAt: -1 });

    if (!lastLog) {
      logWarning('userController.confirmDeleteAccount', `Không tìm thấy OTP request cho: ${phone}`);
      return res.status(400).json({ 
        error: 'no_otp_request', 
        message: 'No OTP request found. Please request OTP first.' 
      });
    }

    // Check expiration
    if (new Date() > lastLog.expiresAt) {
      lastLog.status = 'expired';
      await lastLog.save();
      logWarning('userController.confirmDeleteAccount', `OTP đã hết hạn cho: ${phone}`);
      return res.status(400).json({ 
        error: 'otp_expired', 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    // Check max attempts
    if (lastLog.attempts >= 5) {
      lastLog.status = 'failed';
      await lastLog.save();
      logWarning('userController.confirmDeleteAccount', `Vượt quá số lần thử cho: ${phone}`);
      return res.status(400).json({ 
        error: 'max_attempts_exceeded', 
        message: 'Maximum verification attempts exceeded.' 
      });
    }

    // Sandbox mode - accept any 4-digit code
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      if (!/^\d{4}$/.test(otp)) {
        lastLog.attempts = (lastLog.attempts || 0) + 1;
        await lastLog.save();
        logWarning('userController.confirmDeleteAccount', `OTP không đúng format: ${otp}`);
        return res.status(400).json({ 
          error: 'invalid_otp_format', 
          message: 'OTP must be 4 digits' 
        });
      }

      // Mark OTP as verified
      lastLog.status = 'verified';
      await lastLog.save();

      logWarning('userController.confirmDeleteAccount', `🗑️ XÓA VĨNH VIỄN TÀI KHOẢN (Sandbox): ${phone} | User ID: ${user._id}`);

      // DELETE USER PERMANENTLY
      await User.findByIdAndDelete(user._id);

      // Optional: Delete all OTP logs for this user
      await OtpLog.deleteMany({ phone });

      logUserAction(user._id, 'XÓA TÀI KHOẢN VĨNH VIỄN (Sandbox)', { phone });

      return res.json({ 
        ok: true, 
        message: 'Account deleted successfully (sandbox mode)' 
      });
    }

    // Production: Verify with eSMS
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      logError('userController.confirmDeleteAccount', 'Cấu hình eSMS chưa đầy đủ');
      return res.status(500).json({ 
        error: 'esms_config_missing', 
        message: 'eSMS not configured' 
      });
    }

    logInfo('userController.confirmDeleteAccount', `Xác thực OTP xóa tài khoản qua eSMS cho: ${phone}`);

    const checkUrl = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';
    const verifyResponse = await axios.get(checkUrl, {
      params: {
        ApiKey: apiKey,
        SecretKey: secretKey,
        Phone: phone,
        Code: otp,
        SMSID: lastLog.sessionId
      }
    });

    lastLog.attempts = (lastLog.attempts || 0) + 1;

    if (verifyResponse.data.CodeResult !== '100') {
      await lastLog.save();
      logWarning('userController.confirmDeleteAccount', `OTP không đúng cho: ${phone} (lần thử ${lastLog.attempts}/5)`);
      return res.status(400).json({ 
        error: 'invalid_otp', 
        message: 'Invalid OTP code' 
      });
    }

    // OTP verified - DELETE USER PERMANENTLY
    lastLog.status = 'verified';
    await lastLog.save();

    logWarning('userController.confirmDeleteAccount', `🗑️ XÓA VĨNH VIỄN TÀI KHOẢN (Production): ${phone} | User ID: ${user._id}`);

    await User.findByIdAndDelete(user._id);
    await OtpLog.deleteMany({ phone });

    logUserAction(user._id, 'XÓA TÀI KHOẢN VĨNH VIỄN (Production)', { phone });

    logSuccess('userController.confirmDeleteAccount', `Xóa tài khoản thành công: ${phone}`);

    return res.json({ 
      ok: true, 
      message: 'Account deleted successfully' 
    });

  } catch (err) {
    logError('userController.confirmDeleteAccount', 'Lỗi không xác định khi xác thực OTP xóa tài khoản', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to delete account' 
    });
  }
};
