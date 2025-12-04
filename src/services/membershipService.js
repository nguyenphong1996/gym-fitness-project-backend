const mongoose = require('mongoose');
const User = require('../models/User');
const MembershipPackage = require('../models/MembershipPackage');
const { logInfo, logError } = require('../utils/logger');

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findPackageByIdOrName = async (packageIdOrName) => {
  if (!packageIdOrName) return null;

  // Try ObjectId first
  if (mongoose.Types.ObjectId.isValid(packageIdOrName)) {
    const byId = await MembershipPackage.findById(packageIdOrName);
    if (byId) return byId;
  }

  // Fallback: match by name (case-insensitive exact)
  const nameRegex = new RegExp(`^${escapeRegex(packageIdOrName)}$`, 'i');
  return MembershipPackage.findOne({ name: nameRegex });
};

/**
 * Kích hoạt hoặc gia hạn gói tập cho user
 * @param {string} userId - ID của user
 * @param {string} packageId - ID của gói tập
 * @param {string} transactionId - Mã giao dịch (để log)
 */
exports.activateMembership = async (userId, packageId, transactionId) => {
  const context = 'membershipService.activateMembership';
  try {
    const user = await User.findById(userId);
    const pkg = await findPackageByIdOrName(packageId);

    if (!user) throw new Error(`User not found: ${userId}`);
    if (!pkg) throw new Error(`Package not found: ${packageId}`);

    const now = new Date();
    let newStartDate = now;
    let newEndDate = new Date();

    // Logic cộng dồn ngày
    if (user.membership && user.membership.status === 'active' && user.membership.endDate > now) {
      // Nếu đang còn hạn, cộng nối tiếp vào ngày hết hạn cũ
      newStartDate = user.membership.startDate; // Giữ nguyên ngày bắt đầu gốc
      newEndDate = new Date(user.membership.endDate);
      newEndDate.setDate(newEndDate.getDate() + pkg.durationDays);
    } else {
      // Nếu đã hết hạn hoặc chưa có gói, tính từ hôm nay
      newStartDate = now;
      newEndDate = new Date(now);
      newEndDate.setDate(newEndDate.getDate() + pkg.durationDays);
    }

    // Logic cộng dồn số buổi PT (nếu có)
    let currentSessions = user.membership?.remainingSessions || 0;
    // Nếu gói cũ đã hết hạn, có thể reset session cũ về 0 hoặc bảo lưu tùy chính sách. 
    // Ở đây tạm thời bảo lưu nếu status = active, nếu expired thì reset? 
    // Để đơn giản cho Giai đoạn 1: Cộng dồn bất kể trạng thái (khuyến khích mua thêm)
    const newSessions = currentSessions + (pkg.sessionCount || 0);

    // Logic cộng dồn lượt class (quota). Nếu classQuota = null/undefined => không giới hạn.
    const currentClassCredits = user.membership?.remainingClassCredits ?? 0;
    const newClassCredits =
      pkg.classQuota === null || pkg.classQuota === undefined
        ? null
        : currentClassCredits + (pkg.classQuota || 0);

    // Cập nhật User
    user.membership = {
      packageId: pkg._id,
      startDate: newStartDate,
      endDate: newEndDate,
      remainingSessions: newSessions,
      remainingClassCredits: newClassCredits,
      status: 'active',
      lastRenewalDate: now
    };

    // Nếu user chưa có role customer (ví dụ mới tạo), đảm bảo role đúng
    if (user.role === 'customer') {
      // Có thể thêm logic set isVip nếu gói là loại premium
      // user.isVip = pkg.type === 'premium'; 
    }

    await user.save();

    logInfo(context, `Activated membership for user ${userId}`, {
      package: pkg.name,
      transactionId,
      newEndDate,
      sessions: newSessions,
      classCredits: newClassCredits
    });

    return user.membership;
  } catch (error) {
    logError(context, 'Failed to activate membership', error);
    throw error;
  }
};

/**
 * Kiểm tra điều kiện đặt lịch (PT hoặc Lớp)
 * @param {string} userId 
 * @param {string} type - 'class' hoặc 'pt'
 */
exports.validateBookingEligibility = async (userId, type) => {
  const user = await User.findById(userId).select('membership');
  if (!user || !user.membership) return { allowed: false, reason: 'no_membership' };

  const { status, endDate, remainingSessions } = user.membership;
  const now = new Date();

  if (status !== 'active' || endDate < now) {
    return { allowed: false, reason: 'membership_expired' };
  }

  if (type === 'pt') {
    if (remainingSessions <= 0) {
      return { allowed: false, reason: 'out_of_sessions' };
    }
  }

  return { allowed: true };
};
