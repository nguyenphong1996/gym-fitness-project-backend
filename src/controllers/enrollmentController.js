// controllers/enrollmentController.js
const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');
const ClassAttendance = require('../models/ClassAttendance');
const logger = require('../utils/logger');
const { CLASS_BASE_PRICE } = require('../config/pricing');

const isMembershipActive = (membership) => {
  if (!membership) return false;
  if (membership.status !== 'active') return false;
  if (membership.endDate && membership.endDate < new Date()) return false;
  return true;
};

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

    // Kiểm tra class có tồn tại không và lấy thông tin staff
    const classData = await Class.findById(classId)
      .populate('staffId', 'name email phone role');
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Kiểm tra class status có thuộc nhóm đăng ký cho phép không
    if (!['scheduled', 'waiting_pt'].includes(classData.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot enroll in a class with status '${classData.status}'. Only 'scheduled' or 'waiting_pt' classes can be enrolled.`
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

    // Lấy user + thông tin membership để tính phí class
    const user = await User.findById(userId).populate('membership.packageId');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const membership = user.membership;
    const membershipActive = isMembershipActive(membership);
    const pkg = membershipActive ? membership.packageId : null;

    let priceCharged = CLASS_BASE_PRICE;
    let discountPercent = 0;
    let usedClassCredit = false;

    const hasClassAccess = pkg && (pkg.type === 'class_access' || pkg.type === 'combo');

    if (membershipActive && hasClassAccess) {
      const hasUnlimitedClasses = pkg.classQuota === null || pkg.classQuota === undefined;
      const remainingCredits = membership.remainingClassCredits ?? 0;

      if (hasUnlimitedClasses) {
        priceCharged = 0;
      } else if (remainingCredits > 0) {
        priceCharged = 0;
        usedClassCredit = true;
        membership.remainingClassCredits = remainingCredits - 1;
      } else {
        discountPercent = pkg.classDiscountPercentAfterQuota || 0;
        priceCharged = Math.round(CLASS_BASE_PRICE * (1 - discountPercent / 100));
      }
    } else {
      // Không có quyền class trong gói hoặc membership không active -> thu phí niêm yết
      priceCharged = CLASS_BASE_PRICE;
    }

    if (priceCharged < 0) priceCharged = 0;

    // Tạo enrollment mới
    const enrollment = new Enrollment({
      userId,
      classId,
      status: 'active',
      enrolledAt: new Date(),
      priceCharged,
      discountPercent,
      usedClassCredit
    });

    await enrollment.save();

    // Update currentEnrollment của class
    await Class.findByIdAndUpdate(classId, {
      $inc: { currentEnrollment: 1 }
    });

    // Lưu giảm quota class nếu có
    if (usedClassCredit) {
      await user.save();
    }

    logger.info(`User ${userId} enrolled in class ${classId}`);

    return res.status(201).json({
      success: true,
      message: 'Successfully enrolled in the class',
      data: {
        enrollmentId: enrollment._id,
        classId: enrollment.classId,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        pricing: {
          priceCharged,
          discountPercent,
          usedClassCredit
        }
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
 * @description Tìm kiếm lớp học có sẵn cho customer
 */
exports.searchClasses = async (req, res) => {
  try {
    const {
      category,
      status = 'scheduled',
      location,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
      sortBy = 'startTime',
      sortOrder = 'asc'
    } = req.query;

    // Build filter cho class
    const filter = {};

    // Chỉ hiển thị các lớp đã mở đăng ký (scheduled)
    if (status) {
      if (!['scheduled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. For searching, only "scheduled" classes are available'
        });
      }
      filter.status = status;
    }

    // Filter theo category
    if (category) {
      if (!['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other'].includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category. Must be one of: workout, cardio, stretching, nutrition, yoga, other'
        });
      }
      filter.category = category;
    }

    // Filter theo location
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Filter theo khoảng thời gian
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate format. Use ISO 8601 format.'
          });
        }
        filter.startTime.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate format. Use ISO 8601 format.'
          });
        }
        filter.startTime.$lte = end;
      }
    } else {
      // Mặc định chỉ hiển thị các lớp trong tương lai
      filter.startTime = { $gte: new Date() };
    }

    // Search theo tên class, description, location
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { subcategory: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sortOptions = {};
    const validSortFields = ['startTime', 'endTime', 'createdAt', 'name', 'capacity', 'currentEnrollment'];
    const validSortOrders = ['asc', 'desc'];

    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`
      });
    }

    if (!validSortOrders.includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sortOrder. Must be either "asc" or "desc"'
      });
    }

    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    if (pageNum < 1 || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination. Page must be ≥ 1, limit must be between 1 and 50'
      });
    }

    // Fetch classes với populate staff
    const classes = await Class.find(filter)
      .populate('staffId', 'name email skills')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const total = await Class.countDocuments(filter);

    // Nếu customer đã đăng nhập, kiểm tra các lớp đã đăng ký
    const userId = req.user?.id;
    let enrolledClassIds = [];

    if (userId) {
      const enrollments = await Enrollment.find({
        userId,
        status: { $in: ['active', 'completed'] }
      }).select('classId');
      enrolledClassIds = enrollments.map(e => e.classId.toString());
    }

    // Format response
    const formattedClasses = classes.map(classItem => {
      const isEnrolled = userId ? enrolledClassIds.includes(classItem._id.toString()) : false;
      const availableSpots = classItem.capacity - classItem.currentEnrollment;

      return {
        classId: classItem._id,
        name: classItem.name,
        category: classItem.category,
        subcategory: classItem.subcategory,
        description: classItem.description,
        location: classItem.location,
        capacity: classItem.capacity,
        currentEnrollment: classItem.currentEnrollment,
        availableSpots: Math.max(0, availableSpots),
        isFull: availableSpots <= 0,
        startTime: classItem.startTime,
        endTime: classItem.endTime,
        status: classItem.status,
        instructor: classItem.staffId ? {
          staffId: classItem.staffId._id,
          name: classItem.staffId.name,
          email: classItem.staffId.email,
          skills: classItem.staffId.skills
        } : null,
        createdAt: classItem.createdAt,
        isEnrolledByUser: isEnrolled
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Classes found successfully',
      data: formattedClasses,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      filters: {
        category,
        status,
        location,
        startDate,
        endDate,
        search,
        sortBy,
        sortOrder
      }
    });

  } catch (error) {
    logger.error('Error in searchClasses:', error);
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
    const classData = await Class.findById(classId)
      .populate('staffId', 'name email phone role');
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
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pagination parameters'
      });
    }

    // Fetch enrollments, total count và attendance song song
    const [enrollments, total, attendanceRecords] = await Promise.all([
      Enrollment.find(filter)
        .populate('userId', 'name email phone')
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Enrollment.countDocuments(filter),
      ClassAttendance.find({ classId })
        .select('userId role checkInAt checkOutAt checkInMethod checkOutMethod')
    ]);

    // Build attendance map
    let staffAttendance = null;
    const customerAttendanceMap = new Map();

    attendanceRecords.forEach(record => {
      if (record.role === 'staff') {
        if (!staffAttendance || record.userId?.toString() === classData.staffId?._id?.toString()) {
          staffAttendance = record;
        }
      } else if (record.role === 'customer' && record.userId) {
        customerAttendanceMap.set(record.userId.toString(), record);
      }
    });

    const customerAttendanceList = attendanceRecords.filter(record => record.role === 'customer');

    const enrollmentsData = enrollments.map(enrollment => {
      const user = enrollment.userId;
      const attendance = user ? customerAttendanceMap.get(user._id.toString()) : null;

      return {
        enrollmentId: enrollment._id,
        user: user ? {
          userId: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone
        } : null,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt,
        cancelledAt: enrollment.cancelledAt,
        checkInAt: attendance?.checkInAt || null,
        checkOutAt: attendance?.checkOutAt || null,
        checkInMethod: attendance?.checkInMethod || null,
        checkOutMethod: attendance?.checkOutMethod || null
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully fetched class enrollments',
      data: {
        classId: classData._id,
        className: classData.name,
        classStatus: classData.status,
        capacity: classData.capacity,
        currentEnrollment: classData.currentEnrollment,
        availableSlots: Math.max(0, classData.capacity - classData.currentEnrollment),
        startTime: classData.startTime,
        endTime: classData.endTime,
        location: classData.location,
        staff: classData.staffId ? {
          staffId: classData.staffId._id,
          name: classData.staffId.name,
          email: classData.staffId.email,
          phone: classData.staffId.phone,
          checkInAt: staffAttendance?.checkInAt || null,
          checkOutAt: staffAttendance?.checkOutAt || null,
          checkInMethod: staffAttendance?.checkInMethod || null,
          checkOutMethod: staffAttendance?.checkOutMethod || null
        } : null,
        stats: {
          capacity: classData.capacity,
          registered: classData.currentEnrollment,
          checkedIn: customerAttendanceList.filter(record => Boolean(record.checkInAt)).length,
          checkedOut: customerAttendanceList.filter(record => Boolean(record.checkOutAt)).length
        },
        enrollments: enrollmentsData
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
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
