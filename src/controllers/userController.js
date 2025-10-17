
// controllers/userController.js
const fs = require('fs').promises;
const User = require('../models/User');
const { OtpServiceError } = require('../services/otpService');
const otpService = require('../services/otpService');
const { uploadImage, deleteResource } = require('../utils/cloudinary');
const { validateProfileUpdate, validateOtp } = require('../utils/validation');
const { logError, logSuccess, logWarning, logDebug, logUserAction, logAvatarUpload } = require('../utils/logger');

function handleOtpError(res, err, context, phone) {
  logWarning(context, err.message, { code: err.code, phone });
  return res.status(err.statusCode).json({ 
    error: err.code,
    message: err.message 
  });
}

exports.getProfile = async (req, res) => {
  const context = 'userController.getProfile';
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    const profile = {
      id: user._id,
      phone: user.phone,
      name: user.name || null,
      email: user.email || null,
      avatar: user.avatar?.url || null, // Updated to use new avatar structure
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

exports.updateProfile = async (req, res) => {
  const context = 'userController.updateProfile';
  try {
    // The 'avatar' field is now managed by updateAvatar and cannot be set here.
    if (req.body.avatar || req.body.avatarUrl) {
      return res.status(400).json({
        error: 'invalid_field',
        message: 'Avatar can only be updated via the /api/user/avatar endpoint.'
      });
    }

    const validation = validateProfileUpdate(req.body);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      return res.status(400).json({ error: firstError.error, message: firstError.message });
    }

    if (Object.keys(validation.data).length === 0) {
      return res.status(400).json({ error: 'no_updates', message: 'No valid fields provided for update' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, validation.data, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    logSuccess(context, `Cập nhật profile thành công: ${user.phone}`, { updatedFields: Object.keys(validation.data) });
    logUserAction(user._id, 'Cập nhật profile', { fields: Object.keys(validation.data) });

    return res.json({ ok: true, message: 'Profile updated successfully' });

  } catch (err) {
    logError(context, 'Lỗi khi cập nhật profile', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update profile' });
  }
};

exports.updateAvatar = async (req, res) => {
  const context = 'userController.updateAvatar';
  const tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file_missing', message: 'No image file provided.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found.' });
    }

    // ⏳ Log: Bắt đầu upload avatar
    logAvatarUpload('pending', {
      phone: user.phone,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    // 🔄 Log: Đang xử lý
    logAvatarUpload('processing', {
      phone: user.phone
    });

    // Upload new avatar to Cloudinary
    const { url, cloudinary_id } = await uploadImage(tempPath);

    // If user had an old avatar, delete it from Cloudinary
    const oldCloudinaryId = user.avatar?.cloudinary_id;
    if (oldCloudinaryId) {
      await deleteResource(oldCloudinaryId, 'image');
    }

    // Update user document with new avatar info
    user.avatar = { url, cloudinary_id };
    await user.save();

    // ✅ Log: Upload avatar thành công
    logAvatarUpload('completed', {
      phone: user.phone,
      cloudinary_id: cloudinary_id,
      url: url,
      oldCloudinaryId: oldCloudinaryId
    });

    logUserAction(user._id, 'Cập nhật avatar', { new_id: cloudinary_id });

    return res.json({ 
      ok: true, 
      message: 'Avatar updated successfully', 
      avatar: url 
    });

  } catch (err) {
    // ❌ Log: Upload avatar lỗi
    logAvatarUpload('failed', {
      phone: req.user?.phone,
      fileName: req.file?.originalname,
      error: err.message
    });

    logError(context, 'Lỗi khi cập nhật avatar', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update avatar.' });

  } finally {
    // Clean up the temporary file
    if (tempPath) {
      await fs.unlink(tempPath).catch(err => logWarning(context, `Không thể xóa file tạm: ${tempPath}`, err));
    }
  }
};

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
      const avatarCloudinaryId = user.avatar?.cloudinary_id;

      // Delete avatar from cloudinary before deleting user
      if (avatarCloudinaryId) {
        await deleteResource(avatarCloudinaryId, 'image');
      }

      await User.findByIdAndDelete(userId);
      
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
