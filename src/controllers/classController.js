const crypto = require('crypto');
const QRCode = require('qrcode');
const Class = require('../models/Class');
const ClassAttendance = require('../models/ClassAttendance');
const User = require('../models/User');
const {
  validateCreateClassRequest,
  validateUpdateClassRequest,
  validateObjectId
} = require('../utils/validation');
const { uploadImageBuffer, deleteResource } = require('../utils/cloudinary');
const {
  logError,
  logSuccess,
  logWarning,
  logDebug,
  logAuth
} = require('../utils/logger');

const {
  COMPLETION_DELAY_MINUTES,
  updateClassLifecycleStatus
} = require('../services/classStatusService');

const generateQrCodeForClass = async (classData) => {
  const hasAnyCheckIn = await ClassAttendance.exists({
    classId: classData._id,
    checkInAt: { $ne: null }
  });

  if (hasAnyCheckIn) {
    const error = new Error('Cannot regenerate QR code after check-in has been recorded');
    error.status = 400;
    error.code = 'qr_regeneration_forbidden';
    throw error;
  }

  const randomToken = crypto.randomBytes(24).toString('hex');
  const generatedAt = new Date();
  const payload = JSON.stringify({
    classId: classData._id.toString(),
    token: randomToken,
    type: 'class_check',
    generatedAt: generatedAt.toISOString()
  });

  const qrBuffer = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 2,
    width: 512
  });

  const oldCloudinaryId = classData.qrCode?.cloudinary_id;
  if (oldCloudinaryId) {
    await deleteResource(oldCloudinaryId, 'image');
  }

  const uploadResult = await uploadImageBuffer(qrBuffer, {
    folder: 'gymxfit/class-qrcodes',
    public_id: `class_${classData._id}_qrcode`,
    overwrite: true,
    format: 'png',
    transformation: [{ fetch_format: 'auto' }]
  });

  classData.qrCode = {
    url: uploadResult.url,
    cloudinary_id: uploadResult.cloudinary_id,
    value: payload,
    generatedAt
  };

  await classData.save();

  return classData.qrCode;
};

/**
 * Create new class
 * POST /api/admin/classes/create
 * Body: { name, category, subcategory?, capacity, startTime, endTime, staffId, description?, location? }
 */
exports.createClass = async (req, res) => {
  try {
    logDebug('classController.createClass', 'Bắt đầu tạo lớp học mới');

    // Validate request
    const validation = validateCreateClassRequest(req.body);
    if (!validation.valid) {
      logWarning('classController.createClass', 'Dữ liệu đầu vào không hợp lệ', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Check if PT exists and is a staff
    const staff = await User.findById(validation.data.staffId);
    if (!staff) {
      logWarning('classController.createClass', `PT không tồn tại: ${validation.data.staffId}`);
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    if (staff.role !== 'staff') {
      logWarning('classController.createClass', `Người dùng không phải PT: ${staff.phone} (role: ${staff.role})`);
      return res.status(400).json({
        success: false,
        message: 'Selected user is not a staff member'
      });
    }

    // Check if PT's skills are approved
    if (!staff.skillsApprovedByAdmin) {
      logWarning('classController.createClass', `PT chưa được admin approve skills: ${staff.phone}`);
      return res.status(400).json({
        success: false,
        message: 'Staff skills have not been approved by admin'
      });
    }

    // Check if PT is active
    if (!staff.isActive) {
      logWarning('classController.createClass', `PT không hoạt động: ${staff.phone}`);
      return res.status(400).json({
        success: false,
        message: 'Staff is not active'
      });
    }

    // Create new class
    const newClass = new Class({
      name: validation.data.name,
      category: validation.data.category,
      subcategory: validation.data.subcategory,
      capacity: validation.data.capacity,
      startTime: validation.data.startTime,
      endTime: validation.data.endTime,
      staffId: validation.data.staffId,
      description: validation.data.description,
      location: validation.data.location,
      createdBy: req.user._id,
      status: 'draft',
      currentEnrollment: 0
    });

    await newClass.save();
    
    logSuccess('classController.createClass', `Tạo lớp học thành công: ${newClass._id}`, {
      classId: newClass._id,
      name: newClass.name,
      category: newClass.category,
      staffId: staff.phone
    });

    res.status(201).json({
      success: true,
      message: 'Class created successfully',
      data: newClass
    });
  } catch (error) {
    logError('classController.createClass', 'Lỗi khi tạo lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get all classes with pagination and filters
 * GET /api/admin/classes?page=1&limit=10&status=draft&category=workout&staffId=xxx
 */
exports.getClassList = async (req, res) => {
  try {
    logDebug('classController.getClassList', 'Lấy danh sách lớp học');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};

    if (req.query.status) {
      const validStatuses = [
        'draft',
        'scheduled',
        'waiting_pt',
        'on_going_waiting_customers',
        'on_going',
        'waiting_checkout',
        'completed',
        'expired',
        'overdue',
        'cancelled'
      ];
      if (validStatuses.includes(req.query.status)) {
        filter.status = req.query.status;
      }
    }

    if (req.query.category) {
      const validCategories = ['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other'];
      if (validCategories.includes(req.query.category)) {
        filter.category = req.query.category;
      }
    }

    if (req.query.staffId) {
      const staffIdValidation = validateObjectId(req.query.staffId, { required: false });
      if (staffIdValidation.valid && staffIdValidation.id) {
        filter.staffId = staffIdValidation.id;
      }
    }

    // Get total count
    const total = await Class.countDocuments(filter);

    // Get classes
    const classes = await Class.find(filter)
      .populate('staffId', 'phone name skills')
      .populate('createdBy', 'phone name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    logSuccess('classController.getClassList', `Lấy ${classes.length} lớp học`, {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });

    res.status(200).json({
      success: true,
      message: 'Classes retrieved successfully',
      data: classes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logError('classController.getClassList', 'Lỗi khi lấy danh sách lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get class detail
 * GET /api/admin/classes/:classId
 */
exports.getClassDetail = async (req, res) => {
  try {
    logDebug('classController.getClassDetail', `Lấy chi tiết lớp học: ${req.params.classId}`);

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      logWarning('classController.getClassDetail', 'Class ID không hợp lệ');
      return res.status(400).json({
        success: false,
        message: classIdValidation.message
      });
    }

    const classData = await Class.findById(classIdValidation.id)
      .populate('staffId', 'phone name skills skillsApprovedByAdmin')
      .populate('createdBy', 'phone name');

    if (!classData) {
      logWarning('classController.getClassDetail', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    logSuccess('classController.getClassDetail', `Lấy chi tiết lớp học: ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'Class details retrieved successfully',
      data: classData
    });
  } catch (error) {
    logError('classController.getClassDetail', 'Lỗi khi lấy chi tiết lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update class information
 * PATCH /api/admin/classes/:classId
 * Body: { name?, category?, subcategory?, capacity?, startTime?, endTime?, description?, location?, staffId? }
 */
exports.updateClass = async (req, res) => {
  try {
    logDebug('classController.updateClass', `Cập nhật lớp học: ${req.params.classId}`);

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      return res.status(400).json({
        success: false,
        message: classIdValidation.message
      });
    }

    // Validate update data
    const validation = validateUpdateClassRequest(req.body);
    if (!validation.valid) {
      logWarning('classController.updateClass', 'Dữ liệu cập nhật không hợp lệ', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Find class
    const classData = await Class.findById(classIdValidation.id);

    if (!classData) {
      logWarning('classController.updateClass', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const updateData = validation.data;
    const targetCategory = updateData.category || classData.category;
    const normalizedTargetCategory = targetCategory
      ? targetCategory.toString().toLowerCase()
      : null;

    // Validate new staff if provided
    if (updateData.staffId) {
      const staff = await User.findById(updateData.staffId);
      if (!staff) {
        logWarning('classController.updateClass', `PT không tồn tại: ${updateData.staffId}`);
        return res.status(404).json({
          success: false,
          message: 'Staff not found'
        });
      }

      if (staff.role !== 'staff') {
        logWarning('classController.updateClass', `Người dùng không phải PT: ${staff.phone} (role: ${staff.role})`);
        return res.status(400).json({
          success: false,
          message: 'Selected user is not a staff member'
        });
      }

      if (staff.skillsApprovedByAdmin !== true) {
        logWarning('classController.updateClass', `PT chưa được admin approve skills: ${staff.phone}`);
        return res.status(400).json({
          success: false,
          message: 'Staff skills have not been approved by admin'
        });
      }

      if (!staff.isActive) {
        logWarning('classController.updateClass', `PT không hoạt động: ${staff.phone}`);
        return res.status(400).json({
          success: false,
          message: 'Staff is not active'
        });
      }

      const staffSkills = Array.isArray(staff.skills)
        ? staff.skills.map((skill) => skill.toString().toLowerCase())
        : [];

      if (!normalizedTargetCategory || !staffSkills.includes(normalizedTargetCategory)) {
        logWarning('classController.updateClass', `PT không có kỹ năng phù hợp category: ${staff.phone}`, {
          requiredCategory: normalizedTargetCategory,
          originalCategory: targetCategory,
          staffSkills
        });
        return res.status(400).json({
          success: false,
          message: 'Staff does not have required skill for this class category'
        });
      }
    }

    classData.set(updateData);
    await classData.save();

    await classData.populate([
      { path: 'staffId', select: 'phone name skills skillsApprovedByAdmin' },
      { path: 'createdBy', select: 'phone name' }
    ]);

    logSuccess('classController.updateClass', `Cập nhật lớp học thành công: ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'Class updated successfully',
      data: classData
    });
  } catch (error) {
    logError('classController.updateClass', 'Lỗi khi cập nhật lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Open class for enrollment
 * PATCH /api/admin/classes/:classId/open
 */
exports.openClass = async (req, res) => {
  try {
    logDebug('classController.openClass', `Mở lớp học: ${req.params.classId}`);

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      return res.status(400).json({
        success: false,
        message: classIdValidation.message
      });
    }

    const classData = await Class.findById(classIdValidation.id);
    if (!classData) {
      logWarning('classController.openClass', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    if (classData.status !== 'draft') {
      logWarning('classController.openClass', `Lớp học không ở trạng thái draft: ${classData.status}`);
      return res.status(400).json({
        success: false,
        message: `Cannot open class with status: ${classData.status}`
      });
    }

    classData.status = 'scheduled';
    await classData.save();

    try {
      await generateQrCodeForClass(classData);
    } catch (error) {
      classData.status = 'draft';
      await classData.save();
      throw error;
    }

    logSuccess('classController.openClass', `Mở lớp học thành công: ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'Class opened successfully',
      data: classData
    });
  } catch (error) {
    logError('classController.openClass', 'Lỗi khi mở lớp học', error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    res.status(status).json({
      success: false,
      message: status === 500 ? 'Internal server error' : error.message || 'Failed to open class',
      error: error.code
    });
  }
};

/**
 * Close class (mark as completed or cancelled)
 * PATCH /api/admin/classes/:classId/close
 * Body: { reason?: 'completed' | 'cancelled' }
 */
exports.closeClass = async (req, res) => {
  try {
    logDebug('classController.closeClass', `Đóng lớp học: ${req.params.classId}`);

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      return res.status(400).json({
        success: false,
        message: classIdValidation.message
      });
    }

    const classData = await Class.findById(classIdValidation.id);
    if (!classData) {
      logWarning('classController.closeClass', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const refreshedStatus = await updateClassLifecycleStatus(classData._id);
    if (refreshedStatus) {
      classData.status = refreshedStatus;
    }

    const finalStatuses = ['completed', 'cancelled', 'expired', 'overdue'];
    if (finalStatuses.includes(classData.status)) {
      logWarning('classController.closeClass', `Lớp học đã ở trạng thái cuối: ${classData.status}`);
      return res.status(400).json({
        success: false,
        message: `Class is already ${classData.status}`
      });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.toLowerCase() : 'completed';

    if (reason === 'cancelled') {
      classData.status = 'cancelled';
      classData.updatedAt = new Date();
      await classData.save();

      logSuccess('classController.closeClass', `Đóng lớp học với trạng thái cancelled: ${classData.name}`);
      return res.status(200).json({
        success: true,
        message: 'Class closed as cancelled',
        data: classData
      });
    }

    if (reason !== 'completed') {
      logWarning('classController.closeClass', `Lý do đóng lớp không hợp lệ: ${reason}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid reason. Must be one of: completed, cancelled'
      });
    }

    const completionReadyAt = new Date(classData.endTime);
    completionReadyAt.setMinutes(completionReadyAt.getMinutes() + COMPLETION_DELAY_MINUTES);
    const now = new Date();

    if (now < completionReadyAt) {
      return res.status(400).json({
        success: false,
        message: `Class cannot be marked completed before ${COMPLETION_DELAY_MINUTES} minutes after end time`
      });
    }

    const staffAttendance = await ClassAttendance.findOne({
      classId: classData._id,
      role: 'staff',
      checkInAt: { $ne: null }
    });

    if (!staffAttendance || !staffAttendance.checkOutAt) {
      return res.status(400).json({
        success: false,
        message: 'Staff must check in and check out before completing the class'
      });
    }

    const anyCustomerCheckedIn = await ClassAttendance.exists({
      classId: classData._id,
      role: 'customer',
      checkInAt: { $ne: null }
    });

    if (!anyCustomerCheckedIn) {
      return res.status(400).json({
        success: false,
        message: 'At least one customer must check in before completing the class'
      });
    }

    const anyCustomerCheckedOut = await ClassAttendance.exists({
      classId: classData._id,
      role: 'customer',
      checkInAt: { $ne: null },
      checkOutAt: { $ne: null }
    });

    if (!anyCustomerCheckedOut) {
      return res.status(400).json({
        success: false,
        message: 'At least one customer must check out before completing the class'
      });
    }

    const pendingCustomerAttendance = await ClassAttendance.findOne({
      classId: classData._id,
      role: 'customer',
      checkInAt: { $ne: null },
      $or: [{ checkOutAt: null }, { checkOutAt: { $exists: false } }]
    });

    if (pendingCustomerAttendance) {
      return res.status(400).json({
        success: false,
        message: 'All customers must check out before completing the class'
      });
    }

    classData.status = 'completed';
    classData.updatedAt = now;
    await classData.save();

    logSuccess('classController.closeClass', `Đóng lớp học thành công (completed): ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'Class closed as completed',
      data: classData
    });
  } catch (error) {
    logError('classController.closeClass', 'Lỗi khi đóng lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete class
 * DELETE /api/admin/classes/:classId
 */
exports.deleteClass = async (req, res) => {
  try {
    logDebug('classController.deleteClass', `Xóa lớp học: ${req.params.classId}`);

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      return res.status(400).json({
        success: false,
        message: classIdValidation.message
      });
    }

    const classData = await Class.findByIdAndDelete(classIdValidation.id);

    if (!classData) {
      logWarning('classController.deleteClass', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    logSuccess('classController.deleteClass', `Xóa lớp học thành công: ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    logError('classController.deleteClass', 'Lỗi khi xóa lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Generate class QR Code for check-in/out
 * POST /api/admin/classes/:classId/qrcode
 */
exports.generateClassQRCode = async (req, res) => {
  const context = 'classController.generateClassQRCode';
  try {
    logDebug(context, `Tạo QR code cho lớp học: ${req.params.classId}`, {
      admin: req.user?._id
    });

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      return res.status(400).json({
        success: false,
        error: classIdValidation.error || 'invalid_class_id',
        message: classIdValidation.message
      });
    }

    const classData = await Class.findById(classIdValidation.id);
    if (!classData) {
      logWarning(context, `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        error: 'class_not_found',
        message: 'Class not found'
      });
    }

    if (!['scheduled', 'waiting_pt'].includes(classData.status)) {
      logWarning(context, `Không thể tạo QR code cho lớp với trạng thái: ${classData.status}`, {
        classId: classData._id
      });
      return res.status(400).json({
        success: false,
        error: 'invalid_class_status',
        message: 'QR code can only be generated for classes that are scheduled and waiting for PT check-in'
      });
    }

    await generateQrCodeForClass(classData);

    logSuccess(context, `Tạo QR code thành công cho lớp: ${classData.name}`, {
      classId: classData._id,
      cloudinary_id: classData.qrCode?.cloudinary_id
    });

    return res.status(201).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        classId: classData._id,
        className: classData.name,
        qrCode: classData.qrCode
      }
    });
  } catch (error) {
    logError(context, 'Lỗi khi tạo QR code cho lớp học', error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    return res.status(status).json({
      success: false,
      error: error.code || (status === 500 ? 'server_error' : 'invalid_request'),
      message: status === 500 ? 'Failed to generate class QR code' : error.message
    });
  }
};

/**
 * Get class QR Code for check-in
 * GET /api/admin/classes/:classId/qrcode
 */
exports.getClassQRCode = async (req, res) => {
  try {
    logDebug('classController.getClassQRCode', `Lấy QR code lớp học: ${req.params.classId}`);

    const classIdValidation = validateObjectId(req.params.classId, { required: true, fieldName: 'Class ID' });
    if (!classIdValidation.valid) {
      return res.status(400).json({
        success: false,
        message: classIdValidation.message
      });
    }

    const classData = await Class.findById(classIdValidation.id);

    if (!classData) {
      logWarning('classController.getClassQRCode', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    if (!classData.qrCode || !classData.qrCode.url) {
      logWarning('classController.getClassQRCode', `Lớp học chưa có QR code: ${classData._id}`);
      return res.status(400).json({
        success: false,
        message: 'QR code not generated for this class'
      });
    }

    logSuccess('classController.getClassQRCode', `Lấy QR code thành công: ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'QR code retrieved successfully',
      data: {
        classId: classData._id,
        className: classData.name,
        qrCode: classData.qrCode
      }
    });
  } catch (error) {
    logError('classController.getClassQRCode', 'Lỗi khi lấy QR code', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
