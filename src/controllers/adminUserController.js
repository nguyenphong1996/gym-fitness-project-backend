// controllers/adminUserController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const { logDebug, logSuccess, logError, logWarning } = require('../utils/logger');

/**
 * Build query filters for admin user listing.
 */
function buildUserFilters({ role, search, isVerified, isActive }) {
  const filters = {};

  if (role && ['admin', 'staff', 'customer'].includes(role)) {
    filters.role = role;
  }

  if (typeof isVerified === 'string') {
    if (['true', 'false'].includes(isVerified)) {
      filters.isVerified = isVerified === 'true';
    }
  }

  if (typeof isActive === 'string') {
    if (['true', 'false'].includes(isActive)) {
      filters.isActive = isActive === 'true';
    }
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filters.$or = [
      { phone: regex },
      { name: regex },
      { email: regex }
    ];
  }

  return filters;
}

/**
 * Normalize pagination params.
 */
function normalizePagination(pageParam, limitParam) {
  const page = Math.max(parseInt(pageParam, 10) || 1, 1);
  const limitFromParam = parseInt(limitParam, 10);
  const limit = Math.min(Math.max(limitFromParam || 20, 1), 100);

  return { page, limit };
}

/**
 * Format user object for response payload.
 */
function formatUser(user) {
  return {
    id: user._id,
    phone: user.phone,
    name: user.name || null,
    email: user.email || null,
    role: user.role,
    isVerified: user.isVerified,
    isActive: typeof user.isActive === 'boolean' ? user.isActive : null,
    avatar: user.avatar?.url || null,
    gender: user.gender || null,
    dob: user.dob || null,
    weight: typeof user.weight === 'number' ? user.weight : null,
    height: typeof user.height === 'number' ? user.height : null,
    skills: Array.isArray(user.skills) ? user.skills : [],
    hireDate: user.hireDate || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * GET /api/admin/users
 */
exports.getUserList = async (req, res) => {
  const context = 'adminUserController.getUserList';

  try {
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);
    const filters = buildUserFilters(req.query);

    logDebug(context, 'Admin yêu cầu danh sách user', {
      adminId: req.user?._id || req.user?.id,
      filters,
      page,
      limit
    });

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filters)
        .select('_id phone name email role isVerified isActive avatar gender dob weight height skills hireDate createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filters)
    ]);

    logSuccess(context, `Lấy danh sách user thành công (${users.length}/${total})`, {
      page,
      limit
    });

    return res.json({
      success: true,
      data: users.map(formatUser),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    logError(context, 'Lỗi khi lấy danh sách user', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user list',
      error: error.message
    });
  }
};

/**
 * GET /api/admin/users/:userId
 */
exports.getUserDetail = async (req, res) => {
  const context = 'adminUserController.getUserDetail';

  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      logWarning(context, 'userId không hợp lệ', { userId });
      return res.status(400).json({
        success: false,
        message: 'Invalid user id'
      });
    }

    logDebug(context, 'Admin yêu cầu chi tiết user', {
      adminId: req.user?._id || req.user?.id,
      userId
    });

    const user = await User.findById(userId)
      .select('-__v')
      .lean();

    if (!user) {
      logWarning(context, 'User không tồn tại', { userId });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logSuccess(context, `Lấy thông tin user thành công: ${user.phone}`, { userId });

    return res.json({
      success: true,
      user: formatUser(user)
    });
  } catch (error) {
    logError(context, 'Lỗi khi lấy chi tiết user', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user detail',
      error: error.message
    });
  }
};

module.exports = {
  getUserList: exports.getUserList,
  getUserDetail: exports.getUserDetail
};
