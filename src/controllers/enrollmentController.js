// controllers/enrollmentController.js
const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * @description Đăng ký lớp học
 */
exports.enrollClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    // Validate classId
    if (!classId.match(/^[0-9a-f]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID format'
      });
    }

    // Kiểm tra class có tồn tại không
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Kiểm tra class status có phải 'scheduled' không
    if (classData.status !== 'scheduled') {
      return res.status(409).json({
        success: false,
        message: `Cannot enroll in a class with status '${classData.status}'. Only 'scheduled' classes can be enrolled.`
      });
    }

    // Kiểm tra capacity
    if (classData.currentEnrollment >= classData.capacity) {
      return res.status(409).json({
        success: false,
        message: 'Class is full, cannot enroll'
      });
    }

    // Kiểm tra user đã đăng ký chưa
    const existingEnrollment = await Enrollment.findOne({
      userId,
      classId,
      status: { $in: ['active', 'completed'] }
    });

    if (existingEnrollment) {
      return res.status(409).json({
        success: false,
        message: 'You are already enrolled in this class'
      });
    }

    // Tạo enrollment mới
    const enrollment = new Enrollment({
      userId,
      classId,
      status: 'active',
      enrolledAt: new Date()
    });

    await enrollment.save();

    // Update currentEnrollment của class
    await Class.findByIdAndUpdate(classId, {
      $inc: { currentEnrollment: 1 }
    });

    logger.info(`User ${userId} enrolled in class ${classId}`);

    return res.status(201).json({
      success: true,
      message: 'Successfully enrolled in the class',
      data: {
        enrollmentId: enrollment._id,
        classId: enrollment.classId,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt
      }
    });
  } catch (error) {
    logger.error('Error in enrollClass:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @description Lấy danh sách lớp đã đăng ký của user
 */
exports.getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'active', page = 1, limit = 10 } = req.query;

    // Build filter
    const filter = { userId };
    if (status) {
      if (!['active', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: active, completed, cancelled'
        });
      }
      filter.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch enrollments với class details
    const enrollments = await Enrollment.find(filter)
      .populate('classId', 'name category startTime endTime capacity currentEnrollment status staffId')
      .populate({
        path: 'classId',
        populate: {
          path: 'staffId',
          select: 'name email'
        }
      })
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Enrollment.countDocuments(filter);

    if (enrollments.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No ${status} enrollments found`,
        data: [],
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully fetched enrollments',
      data: enrollments.map(enrollment => ({
        enrollmentId: enrollment._id,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        class: {
          classId: enrollment.classId._id,
          name: enrollment.classId.name,
          category: enrollment.classId.category,
          startTime: enrollment.classId.startTime,
          endTime: enrollment.classId.endTime,
          capacity: enrollment.classId.capacity,
          currentEnrollment: enrollment.classId.currentEnrollment,
          status: enrollment.classId.status,
          instructor: {
            staffId: enrollment.classId.staffId._id,
            name: enrollment.classId.staffId.name,
            email: enrollment.classId.staffId.email
          }
        }
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error in getMyEnrollments:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @description Lấy chi tiết một enrollment
 */
exports.getEnrollmentDetail = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;

    // Validate enrollmentId
    if (!enrollmentId.match(/^[0-9a-f]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid enrollment ID format'
      });
    }

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('classId')
      .populate({
        path: 'classId',
        populate: {
          path: 'staffId',
          select: 'name email skills'
        }
      });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Kiểm tra quyền: user chỉ có thể xem enrollment của mình
    if (enrollment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this enrollment'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully fetched enrollment details',
      data: {
        enrollmentId: enrollment._id,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        cancelledAt: enrollment.cancelledAt,
        cancellationReason: enrollment.cancellationReason,
        class: enrollment.classId
      }
    });
  } catch (error) {
    logger.error('Error in getEnrollmentDetail:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @description Hủy đăng ký lớp
 */
exports.cancelEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;
    const { cancellationReason } = req.body;

    // Validate enrollmentId
    if (!enrollmentId.match(/^[0-9a-f]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid enrollment ID format'
      });
    }

    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found'
      });
    }

    // Kiểm tra quyền
    if (enrollment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this enrollment'
      });
    }

    // Kiểm tra trạng thái
    if (enrollment.status !== 'active') {
      return res.status(409).json({
        success: false,
        message: `Cannot cancel enrollment with status '${enrollment.status}'. Only 'active' enrollments can be cancelled.`
      });
    }

    // Update enrollment
    enrollment.status = 'cancelled';
    enrollment.cancelledAt = new Date();
    enrollment.cancellationReason = cancellationReason || null;
    await enrollment.save();

    // Update currentEnrollment của class
    await Class.findByIdAndUpdate(enrollment.classId, {
      $inc: { currentEnrollment: -1 }
    });

    logger.info(`User ${userId} cancelled enrollment ${enrollmentId}`);

    return res.status(200).json({
      success: true,
      message: 'Successfully cancelled the enrollment',
      data: {
        enrollmentId: enrollment._id,
        status: enrollment.status,
        cancelledAt: enrollment.cancelledAt
      }
    });
  } catch (error) {
    logger.error('Error in cancelEnrollment:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * @description Lấy danh sách enrollments của một class (admin only)
 */
exports.getClassEnrollments = async (req, res) => {
  try {
    const { classId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    // Validate classId
    if (!classId.match(/^[0-9a-f]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid class ID format'
      });
    }

    // Kiểm tra class có tồn tại không
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Build filter
    const filter = { classId };
    if (status) {
      if (!['active', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: active, completed, cancelled'
        });
      }
      filter.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch enrollments
    const enrollments = await Enrollment.find(filter)
      .populate('userId', 'name email phone')
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Enrollment.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: 'Successfully fetched class enrollments',
      data: {
        classId: classData._id,
        className: classData.name,
        enrollments: enrollments.map(enrollment => ({
          enrollmentId: enrollment._id,
          user: {
            userId: enrollment.userId._id,
            name: enrollment.userId.name,
            email: enrollment.userId.email,
            phone: enrollment.userId.phone
          },
          status: enrollment.status,
          enrolledAt: enrollment.enrolledAt,
          cancelledAt: enrollment.cancelledAt
        }))
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error in getClassEnrollments:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
