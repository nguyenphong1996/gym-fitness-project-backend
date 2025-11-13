// controllers/staffProfileController.js

const fs = require('fs').promises;
const User = require('../models/User');
const { validateProfileUpdate, validateSkills } = require('../utils/validation');
const { uploadImage, deleteResource } = require('../utils/cloudinary');
const { logError, logSuccess, logWarning, logDebug, logUserAction, logAvatarUpload } = require('../utils/logger');

function buildSkillRequestPayload(request) {
  if (!request) return null;
  return {
    skills: request.skills || [],
    status: request.status,
    requestedAt: request.requestedAt,
    reviewedAt: request.reviewedAt,
    adminNote: request.adminNote
  };
}

exports.getProfile = async (req, res) => {
  const context = 'staffProfileController.getProfile';
  try {
    const staff = await User.findById(req.user.id)
      .select('_id phone name email avatar gender dob weight height skills skillsApprovedByAdmin skillUpdateRequest hireDate isActive isVerified role');

    if (!staff || staff.role !== 'staff') {
      logWarning(context, 'Staff not found or invalid role', { userId: req.user.id });
      return res.status(404).json({ error: 'staff_not_found', message: 'Staff profile not found' });
    }

    const profile = {
      id: staff._id,
      phone: staff.phone,
      name: staff.name || null,
      email: staff.email || null,
      avatar: staff.avatar?.url || null,
      gender: staff.gender || null,
      dob: staff.dob || null,
      weight: staff.weight || null,
      height: staff.height || null,
      skills: staff.skills || [],
      skillsApprovedByAdmin: staff.skillsApprovedByAdmin,
      skillUpdateRequest: buildSkillRequestPayload(staff.skillUpdateRequest),
      hireDate: staff.hireDate,
      isActive: staff.isActive,
      isVerified: staff.isVerified
    };

    logSuccess(context, 'Fetched staff profile', { userId: staff._id });
    return res.json({ ok: true, staff: profile });
  } catch (error) {
    logError(context, 'Failed to fetch staff profile', error);
    return res.status(500).json({ error: 'server_error', message: 'Failed to fetch staff profile' });
  }
};

exports.updateProfile = async (req, res) => {
  const context = 'staffProfileController.updateProfile';
  try {
    if (req.body.skills || req.body.role || req.body.skillUpdateRequest) {
      return res.status(400).json({
        error: 'invalid_field',
        message: 'Skills must be updated via the dedicated endpoint'
      });
    }

    if (req.body.avatar || req.body.avatarUrl) {
      return res.status(400).json({
        error: 'invalid_field',
        message: 'Avatar can only be updated via the avatar endpoint'
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

    if (validation.data.email) {
      const existingEmailUser = await User.findOne({
        _id: { $ne: req.user.id },
        email: validation.data.email
      }).select('_id');

      if (existingEmailUser) {
        return res.status(409).json({
          error: 'email_taken',
          message: 'Email is already in use'
        });
      }
    }

    const staff = await User.findById(req.user.id).select('_id role');
    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({ error: 'staff_not_found', message: 'Staff profile not found' });
    }

    await User.findByIdAndUpdate(req.user.id, validation.data, { new: false });

    logSuccess(context, 'Cập nhật profile staff thành công', {
      userId: req.user.id,
      fields: Object.keys(validation.data)
    });
    logUserAction(req.user.id, 'Staff update profile', { fields: Object.keys(validation.data) });

    return res.json({ ok: true, message: 'Profile updated successfully' });
  } catch (error) {
    logError(context, 'Failed to update staff profile', error);
    return res.status(500).json({ error: 'server_error', message: 'Failed to update staff profile' });
  }
};

exports.requestSkillUpdate = async (req, res) => {
  const context = 'staffProfileController.requestSkillUpdate';
  try {
    const validation = validateSkills(req.body.skills, { required: true });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, message: validation.message });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({ error: 'staff_not_found', message: 'Staff profile not found' });
    }

    if (staff.skillUpdateRequest && staff.skillUpdateRequest.status === 'pending') {
      return res.status(409).json({
        error: 'skill_request_pending',
        message: 'A skill update request is already pending approval'
      });
    }

    const requestedSkills = validation.skills;
    const currentSkillsSorted = [...(staff.skills || [])].sort();
    const requestedSkillsSorted = [...requestedSkills].sort();

    if (JSON.stringify(currentSkillsSorted) === JSON.stringify(requestedSkillsSorted)) {
      return res.status(400).json({
        error: 'skills_unchanged',
        message: 'New skills must be different from current skills'
      });
    }

    staff.skillUpdateRequest = {
      skills: requestedSkills,
      status: 'pending',
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      adminNote: null
    };

    await staff.save();

    logSuccess(context, 'Staff submitted skill update request', {
      userId: staff._id,
      skills: requestedSkills
    });

    return res.json({
      ok: true,
      message: 'Skill update request submitted. Please wait for admin approval.',
      skillUpdateRequest: buildSkillRequestPayload(staff.skillUpdateRequest)
    });
  } catch (error) {
    logError(context, 'Failed to submit skill update request', error);
    return res.status(500).json({ error: 'server_error', message: 'Failed to submit skill update request' });
  }
};

exports.updateAvatar = async (req, res) => {
  const context = 'staffProfileController.updateAvatar';
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'file_missing',
        message: 'No image file provided'
      });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({ error: 'staff_not_found', message: 'Staff profile not found' });
    }

    logAvatarUpload('pending', {
      phone: staff.phone,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    logAvatarUpload('processing', { phone: staff.phone });

    const { url, cloudinary_id } = await uploadImage(tempPath);

    const oldCloudinaryId = staff.avatar?.cloudinary_id;
    if (oldCloudinaryId) {
      await deleteResource(oldCloudinaryId, 'image');
    }

    staff.avatar = { url, cloudinary_id };
    await staff.save();

    logAvatarUpload('completed', {
      phone: staff.phone,
      cloudinary_id,
      url,
      oldCloudinaryId
    });

    logUserAction(staff._id, 'Staff update avatar', { cloudinary_id });

    return res.json({
      ok: true,
      message: 'Avatar updated successfully',
      avatar: url
    });

  } catch (error) {
    logAvatarUpload('failed', {
      phone: req.user?.phone,
      fileName: req.file?.originalname,
      error: error.message
    });
    logError(context, 'Failed to update staff avatar', error);
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to update avatar'
    });
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(err => logWarning(context, `Không thể xóa file tạm: ${tempPath}`, err));
    }
  }
};
