// controllers/staffController.js

const fs = require('fs').promises;
const User = require('../models/User');
const { validateCreateStaffRequest } = require('../utils/validation');
const { uploadImage, deleteResource } = require('../utils/cloudinary');
const { logError, logSuccess, logWarning, logDebug, logAuth, logUserAction, logAvatarUpload } = require('../utils/logger');

/**
 * Create PT (Staff) account
 * POST /api/admin/staff/create
 * 
 * ✅ Only admin can create PT account
 * ❌ No OTP needed when creating by admin
 * ✅ Skills are required and need admin approval
 * ✅ PT will use OTP to login
 */
exports.createStaff = async (req, res) => {
  const context = 'staffController.createStaff';
  try {
    logDebug(context, 'Bắt đầu tạo tài khoản PT', { 
      admin: req.user._id, 
      body: req.body 
    });

    // 1. Validate input
    const validation = validateCreateStaffRequest(req.body);
    if (!validation.valid) {
      logWarning(context, 'Validation failed', { errors: validation.errors });
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validation.errors
      });
    }

    const { phone, name, email, skills, gender, dob, height, weight } = validation.data;

    // 2. Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      logWarning(context, `Phone số đã tồn tại: ${phone}`);
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    // 3. Check if email already exists (if email provided)
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        logWarning(context, `Email đã tồn tại: ${email}`);
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // 4. Create PT account
    const newStaff = new User({
      phone,
      name,
      email: email || undefined,
      role: 'staff',
      skills,
      skillsApprovedByAdmin: true,   // ← Admin đã xác nhận skills khi tạo
      isActive: true,                // ← Account bật mặc định
      isVerified: false,             // ← Chưa login lần nào (OTP required)
      gender: gender || undefined,
      dob: dob || undefined,
      height: height || undefined,
      weight: weight || undefined,
      hireDate: new Date()           // ← Ngày tuyển dụng = ngày tạo account
    });

    await newStaff.save();

    logSuccess(context, `Tạo tài khoản PT thành công: ${phone}`, {
      staffId: newStaff._id,
      name,
      skills
    });

    logAuth(`PT account created by admin`, phone, true);

    // 5. Return success response
    return res.status(201).json({
      success: true,
      message: 'PT account created successfully',
      staff: {
        id: newStaff._id,
        phone: newStaff.phone,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
        skills: newStaff.skills,
        skillsApprovedByAdmin: newStaff.skillsApprovedByAdmin,
        isActive: newStaff.isActive,
        createdAt: newStaff.createdAt,
        hireDate: newStaff.hireDate
      }
    });

  } catch (error) {
    logError(context, 'Lỗi khi tạo tài khoản PT', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create PT account',
      error: error.message
    });
  }
};

/**
 * Get all staff (PT) list
 * GET /api/admin/staff
 */
exports.getStaffList = async (req, res) => {
  const context = 'staffController.getStaffList';
  try {
    logDebug(context, 'Lấy danh sách PT', { admin: req.user._id });

    const { page = 1, limit = 10, active, skillsApproved } = req.query;
    const query = { role: 'staff' };

    // Filter by active status
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    // Filter by skills approval status
    if (skillsApproved !== undefined) {
      query.skillsApprovedByAdmin = skillsApproved === 'true';
    }

    const staffList = await User.find(query)
      .select('_id phone name email role skills skillsApprovedByAdmin isActive createdAt hireDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    logSuccess(context, `Lấy danh sách PT thành công: ${staffList.length} records`);

    return res.json({
      success: true,
      data: staffList,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logError(context, 'Lỗi khi lấy danh sách PT', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get staff list',
      error: error.message
    });
  }
};

/**
 * Get PT detail
 * GET /api/admin/staff/:staffId
 */
exports.getStaffDetail = async (req, res) => {
  const context = 'staffController.getStaffDetail';
  try {
    const { staffId } = req.params;

    logDebug(context, `Lấy chi tiết PT: ${staffId}`, { admin: req.user._id });

    const staff = await User.findById(staffId).select('-updatedAt');

    if (!staff || staff.role !== 'staff') {
      logWarning(context, `PT không tồn tại: ${staffId}`);
      return res.status(404).json({
        success: false,
        message: 'PT not found'
      });
    }

    logSuccess(context, `Lấy chi tiết PT thành công: ${staff.phone}`);

    return res.json({
      success: true,
      staff
    });

  } catch (error) {
    logError(context, 'Lỗi khi lấy chi tiết PT', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get PT detail',
      error: error.message
    });
  }
};

/**
 * Activate PT account
 * PATCH /api/admin/staff/:staffId/activate
 */
exports.activateStaff = async (req, res) => {
  const context = 'staffController.activateStaff';
  try {
    const { staffId } = req.params;

    logDebug(context, `Kích hoạt tài khoản PT: ${staffId}`, { admin: req.user._id });

    const staff = await User.findByIdAndUpdate(
      staffId,
      { isActive: true },
      { new: true }
    );

    if (!staff || staff.role !== 'staff') {
      logWarning(context, `PT không tồn tại: ${staffId}`);
      return res.status(404).json({
        success: false,
        message: 'PT not found'
      });
    }

    logSuccess(context, `Kích hoạt tài khoản PT thành công: ${staff.phone}`);

    return res.json({
      success: true,
      message: 'PT account activated',
      staff: {
        id: staff._id,
        phone: staff.phone,
        isActive: staff.isActive
      }
    });

  } catch (error) {
    logError(context, 'Lỗi khi kích hoạt tài khoản PT', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to activate PT account',
      error: error.message
    });
  }
};

/**
 * Deactivate PT account
 * PATCH /api/admin/staff/:staffId/deactivate
 */
exports.deactivateStaff = async (req, res) => {
  const context = 'staffController.deactivateStaff';
  try {
    const { staffId } = req.params;

    logDebug(context, `Vô hiệu hóa tài khoản PT: ${staffId}`, { admin: req.user._id });

    const staff = await User.findByIdAndUpdate(
      staffId,
      { isActive: false },
      { new: true }
    );

    if (!staff || staff.role !== 'staff') {
      logWarning(context, `PT không tồn tại: ${staffId}`);
      return res.status(404).json({
        success: false,
        message: 'PT not found'
      });
    }

    logSuccess(context, `Vô hiệu hóa tài khoản PT thành công: ${staff.phone}`);

    return res.json({
      success: true,
      message: 'PT account deactivated',
      staff: {
        id: staff._id,
        phone: staff.phone,
        isActive: staff.isActive
      }
    });

  } catch (error) {
    logError(context, 'Lỗi khi vô hiệu hóa tài khoản PT', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate PT account',
      error: error.message
    });
  }
};

/**
 * Approve PT skills
 * PATCH /api/admin/staff/:staffId/skills/approve
 */
exports.approveStaffSkills = async (req, res) => {
  const context = 'staffController.approveStaffSkills';
  try {
    const { staffId } = req.params;

    logDebug(context, `Xác nhận skills PT: ${staffId}`, { admin: req.user._id });

    const staff = await User.findByIdAndUpdate(
      staffId,
      { skillsApprovedByAdmin: true },
      { new: true }
    );

    if (!staff || staff.role !== 'staff') {
      logWarning(context, `PT không tồn tại: ${staffId}`);
      return res.status(404).json({
        success: false,
        message: 'PT not found'
      });
    }

    logSuccess(context, `Xác nhận skills PT thành công: ${staff.phone}`, {
      skills: staff.skills
    });

    return res.json({
      success: true,
      message: 'PT skills approved',
      staff: {
        id: staff._id,
        phone: staff.phone,
        skills: staff.skills,
        skillsApprovedByAdmin: staff.skillsApprovedByAdmin
      }
    });

  } catch (error) {
    logError(context, 'Lỗi khi xác nhận skills PT', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve PT skills',
      error: error.message
    });
  }
};

/**
 * Update PT avatar (Admin or PT self-service)
 * PUT /api/admin/staff/:staffId/avatar
 */
exports.updateStaffAvatar = async (req, res) => {
  const context = 'staffController.updateStaffAvatar';
  const tempPath = req.file?.path;
  let staff;
  let requester;

  try {
    const { staffId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'file_missing',
        message: 'No image file provided'
      });
    }

    if (!staffId || !/^[0-9a-fA-F]{24}$/.test(staffId)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_staff_id',
        message: 'Invalid staffId'
      });
    }

    requester = await User.findById(req.user.id).select('_id role phone');
    if (!requester) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Requester not found'
      });
    }

    staff = await User.findById(staffId);
    if (!staff || staff.role !== 'staff') {
      return res.status(404).json({
        success: false,
        error: 'staff_not_found',
        message: 'PT not found'
      });
    }

    const isAdmin = requester.role === 'admin';
    const isSelf = requester.role === 'staff' && requester._id.equals(staff._id);

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Only admin or the PT owner can update this avatar'
      });
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

    logUserAction(staff._id, 'Cập nhật avatar PT', {
      updatedBy: requester._id,
      updatedByAdmin: isAdmin
    });

    logSuccess(context, `Cập nhật avatar PT thành công: ${staff.phone}`, {
      staffId: staff._id,
      updatedBy: requester._id,
      updatedByAdmin: isAdmin
    });

    return res.json({
      success: true,
      message: 'Avatar updated successfully',
      staff: {
        id: staff._id,
        avatar: staff.avatar.url,
        updatedByAdmin: isAdmin
      }
    });
  } catch (error) {
    logAvatarUpload('failed', {
      phone: staff?.phone,
      fileName: req.file?.originalname,
      error: error.message
    });

    logError(context, 'Lỗi khi cập nhật avatar PT', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to update PT avatar'
    });
  } finally {
    if (tempPath) {
      await fs.unlink(tempPath).catch(err => logWarning(context, `Không thể xóa file tạm: ${tempPath}`, err));
    }
  }
};

module.exports = {
  createStaff: exports.createStaff,
  getStaffList: exports.getStaffList,
  getStaffDetail: exports.getStaffDetail,
  activateStaff: exports.activateStaff,
  deactivateStaff: exports.deactivateStaff,
  approveStaffSkills: exports.approveStaffSkills,
  updateStaffAvatar: exports.updateStaffAvatar
};
