const crypto = require('crypto');
const QRCode = require('qrcode');
const Class = require('../models/Class');
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
      const validStatuses = ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'];
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
 * Body: { name?, category?, subcategory?, capacity?, startTime?, endTime?, description?, location? }
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

    // Find and update class
    const classData = await Class.findByIdAndUpdate(
      classIdValidation.id,
      { $set: validation.data },
      { new: true, runValidators: true }
    )
      .populate('staffId', 'phone name skills')
      .populate('createdBy', 'phone name');

    if (!classData) {
      logWarning('classController.updateClass', `Lớp học không tồn tại: ${classIdValidation.id}`);
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

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

    logSuccess('classController.openClass', `Mở lớp học thành công: ${classData.name}`);

    res.status(200).json({
      success: true,
      message: 'Class opened successfully',
      data: classData
    });
  } catch (error) {
    logError('classController.openClass', 'Lỗi khi mở lớp học', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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

    // Determine new status
    const newStatus = req.body.reason === 'cancelled' ? 'cancelled' : 'completed';

    if (['completed', 'cancelled'].includes(classData.status)) {
      logWarning('classController.closeClass', `Lớp học đã ${classData.status}: ${classData._id}`);
      return res.status(400).json({
        success: false,
        message: `Class is already ${classData.status}`
      });
    }

    classData.status = newStatus;
    await classData.save();

    logSuccess('classController.closeClass', `Đóng lớp học thành công (${newStatus}): ${classData.name}`);

    res.status(200).json({
      success: true,
      message: `Class closed as ${newStatus}`,
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

    if (!['scheduled', 'ongoing'].includes(classData.status)) {
      logWarning(context, `Không thể tạo QR code cho lớp với trạng thái: ${classData.status}`, {
        classId: classData._id
      });
      return res.status(400).json({
        success: false,
        error: 'invalid_class_status',
        message: 'QR code can only be generated for classes that are scheduled or ongoing'
      });
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

    logSuccess(context, `Tạo QR code thành công cho lớp: ${classData.name}`, {
      classId: classData._id,
      cloudinary_id: uploadResult.cloudinary_id
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
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to generate class QR code'
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
