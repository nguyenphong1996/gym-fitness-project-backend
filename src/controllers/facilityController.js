const Facility = require('../models/Facility');
const FacilityCheckin = require('../models/FacilityCheckin');
const User = require('../models/User');
const MembershipPackage = require('../models/MembershipPackage');
const { logInfo, logError, logWarning } = require('../utils/logger');

exports.checkInFacility = async (req, res) => {
  const context = 'facilityController.checkInFacility';
  try {
    const { scanData } = req.body;
    const userId = req.user.id;

    if (!scanData) {
      return res.status(400).json({
        success: false,
        message: 'Scan data is required'
      });
    }

    // 1. Tìm Facility dựa trên QR code
    const facility = await Facility.findOne({ qrCodeData: scanData, isActive: true });
    if (!facility) {
      return res.status(404).json({
        success: false,
        message: 'Khu vực không tồn tại hoặc mã QR không hợp lệ.'
      });
    }

    // 2. Lấy thông tin User và Gói tập
    const user = await User.findById(userId).populate('membership.packageId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 3. Kiểm tra trạng thái Membership chung
    if (!user.membership || user.membership.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Gói tập của bạn đã hết hạn hoặc chưa được kích hoạt.'
      });
    }

    const now = new Date();
    if (user.membership.endDate < now) {
      return res.status(403).json({
        success: false,
        message: 'Gói tập của bạn đã hết hạn.'
      });
    }

    const currentPackage = user.membership.packageId;
    if (!currentPackage) {
      return res.status(403).json({
        success: false,
        message: 'Không tìm thấy thông tin gói tập.'
      });
    }

    // 4. Kiểm tra quyền truy cập khu vực cụ thể (Facility Access)
    // facilityCode ví dụ: 'swimmingPool'
    // package.facilityAccess ví dụ: { swimmingPool: false, ... }
    const accessAllowed = currentPackage.facilityAccess && currentPackage.facilityAccess[facility.facilityCode];

    if (!accessAllowed) {
      logWarning(context, `Access denied for user ${userId} at ${facility.facilityCode}`);
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: `Gói ${currentPackage.name} của bạn không bao gồm quyền truy cập ${facility.name}. Vui lòng nâng cấp gói để sử dụng dịch vụ này.`
      });
    }

    // 5. Ghi nhận Check-in thành công
    await FacilityCheckin.create({
      userId,
      facilityId: facility._id,
      facilityCode: facility.facilityCode,
      checkinTime: new Date(),
      isSuccessful: true
    });

    logInfo(context, `User ${userId} checked in at ${facility.facilityCode}`);

    return res.status(200).json({
      success: true,
      message: `Check-in thành công! Chúc bạn có trải nghiệm tốt tại ${facility.name}.`,
      data: {
        facility: facility.name,
        checkinTime: new Date()
      }
    });

  } catch (error) {
    logError(context, 'Facility check-in error', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi xử lý check-in.'
    });
  }
};

exports.getMyAccess = async (req, res) => {
  const context = 'facilityController.getMyAccess';
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('membership.packageId');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.membership || !user.membership.packageId) {
      return res.json({
        success: true,
        access: {
          gymFloor: false,
          swimmingPool: false,
          sauna: false,
          spa: false
        },
        packageName: 'None'
      });
    }

    const pkg = user.membership.packageId;
    const isExpired = user.membership.status !== 'active' || user.membership.endDate < new Date();

    // If expired, all access is false
    if (isExpired) {
      return res.json({
        success: true,
        access: {
          gymFloor: false,
          swimmingPool: false,
          sauna: false,
          spa: false
        },
        packageName: pkg.name,
        status: 'expired'
      });
    }

    return res.json({
      success: true,
      access: pkg.facilityAccess || {},
      packageName: pkg.name,
      status: 'active'
    });

  } catch (error) {
    logError(context, 'Failed to get my access', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- Admin Functions ---

exports.getAllFacilities = async (req, res) => {
  try {
    const facilities = await Facility.find().sort({ name: 1 });
    res.json({ success: true, data: facilities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFacility = async (req, res) => {
  try {
    const { facilityCode, name, description, qrCodeData } = req.body;
    const facility = await Facility.create({
      facilityCode,
      name,
      description,
      qrCodeData: qrCodeData || facilityCode // Default QR data to code if not provided
    });
    res.status(201).json({ success: true, data: facility });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCheckinHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, facilityCode, userId } = req.query;
    const filter = {};
    if (facilityCode) filter.facilityCode = facilityCode;
    if (userId) filter.userId = userId;

    const skip = (page - 1) * limit;
    const [checkins, total] = await Promise.all([
      FacilityCheckin.find(filter)
        .populate('userId', 'name phone')
        .populate('facilityId', 'name')
        .sort({ checkinTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FacilityCheckin.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: checkins,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
