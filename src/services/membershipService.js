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

const BILLING_CYCLE_MULTIPLIERS = {
  month: 1,
  quarter: 3,
  year: 12
};

const BILLING_CYCLE_DISCOUNTS = {
  month: 0,
  quarter: 20,
  year: 50
};

const normalizeBillingCycle = (cycle) => {
  const raw = (cycle || 'month').toString().toLowerCase();
  if (['quarter', 'quarterly', '3m', 'quy'].includes(raw)) return 'quarter';
  if (['year', 'yearly', 'annual', '12m', 'nam'].includes(raw)) return 'year';
  return 'month';
};

const calculatePackagePrice = (pkg, billingCycle = 'month') => {
  const cycle = normalizeBillingCycle(billingCycle);
  const multiplier = BILLING_CYCLE_MULTIPLIERS[cycle] || 1;
  const discount = BILLING_CYCLE_DISCOUNTS[cycle] || 0;
  const base = (pkg.price || 0) * multiplier;
  const price = Math.max(0, Math.round(base * (1 - discount / 100)));
  return { price, multiplier, discount, cycle };
};

/**
 * Tính toán chi phí nâng cấp: trừ giá trị thời gian còn lại của gói hiện tại
 */
exports.calculateUpgradeQuote = async (userId, targetPackageId, billingCycle = 'month') => {
  const context = 'membershipService.calculateUpgradeQuote';
  const user = await User.findById(userId).populate('membership.packageId');
  if (!user) {
    const err = new Error('User not found');
    err.code = 'user_not_found';
    err.status = 404;
    throw err;
  }

  const membership = user.membership;
  const now = new Date();
  if (!membership || membership.status !== 'active' || !membership.endDate || membership.endDate < now) {
    const err = new Error('No active membership to upgrade');
    err.code = 'no_active_membership';
    err.status = 400;
    throw err;
  }

  const currentPkg = membership.packageId?.name ? membership.packageId : await MembershipPackage.findById(membership.packageId);
  if (!currentPkg) {
    const err = new Error('Current package not found');
    err.code = 'current_package_not_found';
    err.status = 404;
    throw err;
  }

  const targetPkg = await findPackageByIdOrName(targetPackageId);
  if (!targetPkg) {
    const err = new Error('Target package not found');
    err.code = 'target_package_not_found';
    err.status = 404;
    throw err;
  }

  // Không cho hạ cấp: so sánh giá base (tháng)
  if ((targetPkg.price || 0) <= (currentPkg.price || 0)) {
    const err = new Error('Downgrade is not allowed');
    err.code = 'downgrade_not_allowed';
    err.status = 400;
    throw err;
  }

  const { price: targetPrice, multiplier, discount, cycle } = calculatePackagePrice(targetPkg, billingCycle);

  // Giá trị còn lại của gói hiện tại theo ngày
  const dayMs = 24 * 60 * 60 * 1000;
  const remainingDays = Math.max(0, Math.ceil((membership.endDate - now) / dayMs));
  const currentDuration = currentPkg.durationDays || 30;
  const currentPerDay = (currentPkg.price || 0) / currentDuration;
  const creditValue = Math.max(0, Math.round(currentPerDay * remainingDays));

  const amountDue = Math.max(0, targetPrice - creditValue);
  const durationDays = (targetPkg.durationDays || 0) * multiplier;
  const upgradeFromPackageId = currentPkg._id?.toString?.() || membership.packageId;

  return {
    amountDue,
    creditValue,
    targetPrice,
    billingCycle: cycle,
    discount,
    remainingDays,
    durationDays,
    package: {
      current: {
        id: upgradeFromPackageId,
        name: currentPkg.name,
        price: currentPkg.price
      },
      target: {
        id: targetPkg._id?.toString?.(),
        name: targetPkg.name,
        price: targetPkg.price
      }
    },
    upgradeFromPackageId
  };
};

/**
 * Kích hoạt hoặc gia hạn gói tập cho user
 * @param {string} userId - ID của user
 * @param {string} packageId - ID của gói tập
 * @param {string} transactionId - Mã giao dịch (để log)
 * @param {string} billingCycle - month | quarter | year (default month)
 */
exports.activateMembership = async (userId, packageId, transactionId, billingCycle = 'month') => {
  const context = 'membershipService.activateMembership';
  try {
    const user = await User.findById(userId);
    const pkg = await findPackageByIdOrName(packageId);

    if (!user) throw new Error(`User not found: ${userId}`);
    if (!pkg) throw new Error(`Package not found: ${packageId}`);

    const cycle = normalizeBillingCycle(billingCycle);
    const multiplier = BILLING_CYCLE_MULTIPLIERS[cycle] || 1;
    const appliedDurationDays = (pkg.durationDays || 0) * multiplier;
    const packageSessionCount = (pkg.sessionCount || 0) * multiplier;
    const packageClassQuota =
      pkg.classQuota === null || pkg.classQuota === undefined
        ? null
        : (pkg.classQuota || 0) * multiplier;

    const now = new Date();
    let newStartDate = now;
    let newEndDate = new Date();

    // Logic cộng dồn ngày
    if (user.membership && user.membership.status === 'active' && user.membership.endDate > now) {
      // Nếu đang còn hạn, cộng nối tiếp vào ngày hết hạn cũ
      newStartDate = user.membership.startDate; // Giữ nguyên ngày bắt đầu gốc
      newEndDate = new Date(user.membership.endDate);
      newEndDate.setDate(newEndDate.getDate() + appliedDurationDays);
    } else {
      // Nếu đã hết hạn hoặc chưa có gói, tính từ hôm nay
      newStartDate = now;
      newEndDate = new Date(now);
      newEndDate.setDate(newEndDate.getDate() + appliedDurationDays);
    }

    // Logic cộng dồn số buổi PT (nếu có)
    let currentSessions = user.membership?.remainingSessions || 0;
    // Nếu gói cũ đã hết hạn, có thể reset session cũ về 0 hoặc bảo lưu tùy chính sách. 
    // Ở đây tạm thời bảo lưu nếu status = active, nếu expired thì reset? 
    // Để đơn giản cho Giai đoạn 1: Cộng dồn bất kể trạng thái (khuyến khích mua thêm)
    const newSessions = currentSessions + packageSessionCount;

    // Logic cộng dồn lượt class (quota). Nếu classQuota = null/undefined => không giới hạn.
    const currentClassCredits = user.membership?.remainingClassCredits ?? 0;
    const newClassCredits =
      packageClassQuota === null || packageClassQuota === undefined
        ? null
        : currentClassCredits + packageClassQuota;

    // Cập nhật User
    user.membership = {
      packageId: pkg._id,
      startDate: newStartDate,
      endDate: newEndDate,
      remainingSessions: newSessions,
      remainingClassCredits: newClassCredits,
      status: 'active',
      lastRenewalDate: now,
      billingCycle: cycle
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
      billingCycle: cycle,
      durationDays: appliedDurationDays,
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
 * Nâng cấp gói: trừ giá trị còn lại, áp dụng gói mới từ thời điểm nâng cấp
 */
exports.upgradeMembership = async (userId, targetPackageId, transactionId, billingCycle = 'month') => {
  const context = 'membershipService.upgradeMembership';
  try {
    const quote = await exports.calculateUpgradeQuote(userId, targetPackageId, billingCycle);
    const user = await User.findById(userId);
    const targetPkg = await findPackageByIdOrName(targetPackageId);

    if (!user) throw new Error(`User not found: ${userId}`);
    if (!targetPkg) throw new Error(`Package not found: ${targetPackageId}`);

    const multiplier = BILLING_CYCLE_MULTIPLIERS[quote.billingCycle] || 1;
    const now = new Date();
    const newEndDate = new Date(now);
    newEndDate.setDate(newEndDate.getDate() + (targetPkg.durationDays || 0) * multiplier);

    const newSessions = (targetPkg.sessionCount || 0) * multiplier;
    const newClassCredits =
      targetPkg.classQuota === null || targetPkg.classQuota === undefined
        ? null
        : (targetPkg.classQuota || 0) * multiplier;

    user.membership = {
      packageId: targetPkg._id,
      startDate: now,
      endDate: newEndDate,
      remainingSessions: newSessions,
      remainingClassCredits: newClassCredits,
      status: 'active',
      lastRenewalDate: now,
      billingCycle: quote.billingCycle
    };

    await user.save();

    logInfo(context, `Upgraded membership for user ${userId}`, {
      from: quote.package.current.name,
      to: targetPkg.name,
      transactionId,
      billingCycle: quote.billingCycle,
      creditValue: quote.creditValue,
      amountDue: quote.amountDue
    });

    return user.membership;
  } catch (error) {
    logError(context, 'Failed to upgrade membership', error);
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
