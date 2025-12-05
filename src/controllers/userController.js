
// controllers/userController.js
const fs = require('fs').promises;
const User = require('../models/User');
const OtpLog = require('../models/OtpLog');
const { OtpServiceError } = require('../services/otpService');
const otpService = require('../services/otpService');
const membershipService = require('../services/membershipService');
const { uploadImage, deleteResource } = require('../utils/cloudinary');
const { validateProfileUpdate, validateOtp } = require('../utils/validation');
const { logError, logSuccess, logWarning, logDebug, logUserAction, logAvatarUpload } = require('../utils/logger');

function handleOtpError(res, err, context) {
  logWarning(context, err.message, { code: err.code });
  return res.status(err.statusCode).json({
    error: err.code,
    message: err.message
  });
}

function buildMembershipResponse(user) {
  if (!user?.membership) return null;

  const pkg = user.membership.packageId;
  const endDate = user.membership.endDate || null;
  const expiredByDate = endDate ? new Date(endDate) < new Date() : false;
  const status = expiredByDate ? 'expired' : (user.membership.status || 'none');

  const defaultAccess = {
    gymFloor: false,
    swimmingPool: false,
    sauna: false,
    spa: false
  };

  const resolvedPackageId =
    pkg?._id?.toString?.() ||
    (typeof pkg === 'string' ? pkg : null) ||
    pkg?.toString?.() ||
    user.membership.packageId?.toString?.() ||
    user.membership.packageId;

  const remainingClassCredits = user.membership.remainingClassCredits;

  return {
    packageId: resolvedPackageId || null,
    packageName: pkg?.name || null,
    packageType: pkg?.type || null,
    facilityAccess: pkg?.facilityAccess || defaultAccess,
    sessionCount: pkg?.sessionCount ?? null,
    classQuota: pkg?.classQuota ?? null,
    startDate: user.membership.startDate || null,
    endDate,
    remainingSessions: user.membership.remainingSessions ?? 0,
    remainingClassCredits: remainingClassCredits === undefined ? 0 : remainingClassCredits,
    status,
    billingCycle: user.membership.billingCycle || 'month'
  };
}

exports.getProfile = async (req, res) => {
  const context = 'userController.getProfile';
  try {
    const userDoc = await membershipService.getUserWithFreshMembership(req.user.id);
    const user = userDoc?.toObject ? userDoc.toObject() : userDoc;
    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    const membership = buildMembershipResponse(user);

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
      createdAt: user.createdAt,
      membership
    };

    logSuccess(context, 'Lấy profile thành công', { userId: user._id });
    return res.json({ ok: true, user: profile });

  } catch (err) {
    logError(context, 'Lỗi khi lấy profile', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to get profile' });
  }
};

exports.getMembership = async (req, res) => {
  const context = 'userController.getMembership';
  try {
    const userDoc = await membershipService.getUserWithFreshMembership(req.user.id);
    const user = userDoc?.toObject ? userDoc.toObject() : userDoc;

    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    }

    const membership = buildMembershipResponse(user);

    if (!membership) {
      logSuccess(context, 'User has no membership', { userId: req.user.id });
      return res.json({
        ok: true,
        membership: null,
        message: 'User has no active membership'
      });
    }

    logSuccess(context, 'Fetched membership info', {
      userId: req.user.id,
      packageName: membership.packageName,
      status: membership.status
    });

    return res.json({ ok: true, membership });

  } catch (err) {
    logError(context, 'Lỗi khi lấy membership', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to get membership info' });
  }
};

exports.getUpgradeQuote = async (req, res) => {
  const context = 'userController.getUpgradeQuote';
  try {
    const { packageId, billingCycle } = req.query;
    if (!packageId) {
      return res.status(400).json({ error: 'missing_package_id', message: 'packageId is required' });
    }

    const quote = await membershipService.calculateUpgradeQuote(req.user.id, packageId, billingCycle);

    logSuccess(context, 'Calculated upgrade quote', {
      userId: req.user.id,
      targetPackage: packageId,
      billingCycle: quote.billingCycle
    });

    return res.json({ ok: true, quote });
  } catch (err) {
    const status = err.status || 500;
    const code = err.code || 'server_error';
    const message = err.message || 'Failed to calculate upgrade quote';

    logError(context, 'Lỗi khi tính phí nâng cấp', err);
    return res.status(status).json({ error: code, message });
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

    logSuccess(context, 'Cập nhật profile thành công', {
      userId: user._id,
      updatedFields: Object.keys(validation.data)
    });
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
      userId: user._id.toString(),
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    // 🔄 Log: Đang xử lý
    logAvatarUpload('processing', {
      userId: user._id.toString()
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
      userId: user._id.toString(),
      cloudinary_id,
      url,
      oldCloudinaryId
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
      userId: req.user?.id ? req.user.id.toString() : null,
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

    logWarning(context, '⚠️ Yêu cầu XÓA TÀI KHOẢN', { userId: user._id });
    const result = await otpService.requestOtp(phone, 'delete_account', req.ip);

    return res.json(result);

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(res, err, context);
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

    if (!user.isActive) {
      return res.status(400).json({ error: 'account_already_deactivated', message: 'Account is already deactivated.' });
    }

    logWarning(context, '⚠️ XÁC NHẬN VÔ HIỆU HÓA TÀI KHOẢN', { userId: user._id });

    const isVerified = await otpService.verifyOtp(user.phone, otp, 'delete_account');

    if (isVerified) {
      const userId = user._id;
      const userPhone = user.phone;

      user.isActive = false;
      user.deactivatedAt = new Date();
      await user.save();

      await OtpLog.deleteMany({ phone: userPhone });

      logWarning(context, '🔒 VÔ HIỆU HÓA TÀI KHOẢN', { userId });
      logUserAction(userId, 'VÔ HIỆU HÓA TÀI KHOẢN');

      return res.json({ ok: true, message: 'Account deactivated successfully' });
    }

    return res.status(400).json({ error: 'invalid_otp', message: 'Invalid OTP code.' });

  } catch (err) {
    if (err instanceof OtpServiceError) {
      return handleOtpError(res, err, context);
    }
    logError(context, 'Lỗi không xác định khi xác thực OTP vô hiệu hóa tài khoản', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to deactivate account' });
  }
};
