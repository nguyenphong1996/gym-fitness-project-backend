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
  const user = await exports.getUserWithFreshMembership(userId);
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

  // Không cho hạ cấp: so sánh tier (mặc định = 1 nếu thiếu)
  const currentTier = currentPkg.tier;
  const targetTier = targetPkg.tier;
  const hasTierInfo = currentTier !== undefined && targetTier !== undefined;
  if (hasTierInfo ? (targetTier < currentTier) : ((targetPkg.price || 0) < (currentPkg.price || 0))) {
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
 * Tính toán số tiền cần thanh toán cho nâng cấp TẠM THỜI (Trial/Experience)
 * Logic: Chỉ khấu hao phần giá trị của gói cũ tương ứng với thời gian của gói mới (overlap)
 * Ví dụ: Đang dùng Basic 1 năm (10k/ngày). Mua Premium 1 tháng (30 ngày).
 * Credit = 10k * 30 = 300k (chứ không phải tính hết cả năm còn lại)
 */
exports.calculateTemporaryUpgradeQuote = async (userId, targetPackageId, billingCycle = 'month') => {
  const user = await User.findById(userId).populate('membership.packageId');
  const targetPkg = await findPackageByIdOrName(targetPackageId);

  if (!user) throw new Error(`User not found: ${userId}`);
  if (!targetPkg) throw new Error(`Package not found: ${targetPackageId}`);

  const membership = user.membership;
  // Nếu không có gói active, coi như mua mới hoàn toàn (không có credit)
  if (!membership || membership.status !== 'active' || !membership.packageId) {
    const cycle = normalizeBillingCycle(billingCycle);
    const multiplier = BILLING_CYCLE_MULTIPLIERS[cycle] || 1;
    const discount = BILLING_CYCLE_DISCOUNTS[cycle] || 0;
    const base = targetPkg.price * multiplier;
    const amount = Math.round(base * (1 - discount / 100));
    
    return {
      amountDue: amount,
      creditValue: 0,
      targetPrice: amount,
      billingCycle: cycle,
      discount,
      remainingDays: 0,
      durationDays: (targetPkg.durationDays || 0) * multiplier,
      package: {
        current: null,
        target: { id: targetPkg._id.toString(), name: targetPkg.name, price: targetPkg.price }
      },
      upgradeFromPackageId: null
    };
  }

  const currentPkg = membership.packageId;
  const now = new Date();
  
  // Tính giá gói đích
  const cycle = normalizeBillingCycle(billingCycle);
  const multiplier = BILLING_CYCLE_MULTIPLIERS[cycle] || 1;
  const discount = BILLING_CYCLE_DISCOUNTS[cycle] || 0;
  const baseTarget = targetPkg.price * multiplier;
  const targetPrice = Math.round(baseTarget * (1 - discount / 100));
  const targetDurationDays = (targetPkg.durationDays || 0) * multiplier;

  // Tính giá trị khấu hao của gói hiện tại (chỉ tính trong khoảng thời gian overlap)
  const dayMs = 24 * 60 * 60 * 1000;
  const remainingDaysTotal = Math.max(0, Math.ceil((membership.endDate - now) / dayMs));
  
  // Số ngày được tính credit = Min(Số ngày còn lại của gói cũ, Thời hạn gói mới)
  const overlapDays = Math.min(remainingDaysTotal, targetDurationDays);

  const currentDuration = currentPkg.durationDays || 30;
  const currentPerDay = (currentPkg.price || 0) / currentDuration;
  const creditValue = Math.max(0, Math.round(currentPerDay * overlapDays));

  const amountDue = Math.max(0, targetPrice - creditValue);

  return {
    amountDue,
    creditValue,
    targetPrice,
    billingCycle: cycle,
    discount,
    remainingDays: remainingDaysTotal,
    durationDays: targetDurationDays,
    overlapDays,
    package: {
      current: {
        id: currentPkg._id.toString(),
        name: currentPkg.name,
        price: currentPkg.price
      },
      target: {
        id: targetPkg._id.toString(),
        name: targetPkg.name,
        price: targetPkg.price
      }
    },
    upgradeFromPackageId: currentPkg._id.toString()
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
    const isSamePackage = user.membership?.packageId?.toString() === pkg._id.toString();

    if (user.membership && user.membership.status === 'active' && user.membership.endDate > now) {
      if (isSamePackage) {
        // Nếu cùng gói và còn hạn: Cộng nối tiếp (Renewal)
        newStartDate = user.membership.startDate;
        newEndDate = new Date(user.membership.endDate);
        newEndDate.setDate(newEndDate.getDate() + appliedDurationDays);
      } else {
        // Nếu khác gói: Reset ngày bắt đầu từ hôm nay (Start New)
        // Lưu ý: Nếu muốn bảo lưu giá trị cũ, client phải dùng API upgradeMembership
        newStartDate = now;
        newEndDate = new Date(now);
        newEndDate.setDate(newEndDate.getDate() + appliedDurationDays);
      }
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
    const user = await exports.getUserWithFreshMembership(userId);
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

const revertTempIfExpired = async (user) => {
  if (!user?.membershipTemp?.isTemporary) return { reverted: false, user };
  const now = new Date();
  if (user.membershipTemp.endDate && user.membershipTemp.endDate <= now) {
    const restore = user.membershipTemp.restoreTo || {};
    user.membership = {
      packageId: restore.packageId || null,
      startDate: restore.startDate || null,
      endDate: restore.endDate || null,
      remainingSessions: restore.remainingSessions ?? 0,
      remainingClassCredits: restore.remainingClassCredits ?? 0,
      status: restore.status || 'expired',
      billingCycle: restore.billingCycle || 'month',
      lastRenewalDate: restore.startDate || null
    };
    user.membershipTemp = undefined;
    await user.save();
    await user.populate('membership.packageId');
    return { reverted: true, user };
  }
  return { reverted: false, user };
};

exports.getUserWithFreshMembership = async (userId) => {
  const user = await User.findById(userId).populate(['membership.packageId', 'membershipTemp.packageId', 'membershipTemp.restoreTo.packageId']);
  if (!user) return null;
  await revertTempIfExpired(user);
  return user;
};

/**
 * Nâng cấp tạm thời: áp gói mới trong thời gian temp, sau đó sẽ revert về gói cũ
 */
exports.upgradeMembershipTemporary = async (userId, targetPackageId, transactionId, billingCycle = 'month') => {
  const context = 'membershipService.upgradeMembershipTemporary';
  try {
    const user = await exports.getUserWithFreshMembership(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    if (user.membershipTemp?.isTemporary) {
      throw Object.assign(new Error('Temporary upgrade already active'), { code: 'temp_upgrade_in_progress', status: 400 });
    }

    const quote = await exports.calculateUpgradeQuote(userId, targetPackageId, billingCycle);
    const targetPkg = await findPackageByIdOrName(targetPackageId);
    if (!targetPkg) throw new Error(`Package not found: ${targetPackageId}`);

    // Backup gói hiện tại để khôi phục sau khi temp hết hạn
    const backup = {
      packageId: user.membership.packageId,
      startDate: user.membership.startDate,
      endDate: user.membership.endDate,
      remainingSessions: user.membership.remainingSessions,
      remainingClassCredits: user.membership.remainingClassCredits,
      status: user.membership.status,
      billingCycle: user.membership.billingCycle
    };

    const cycle = quote.billingCycle || normalizeBillingCycle(billingCycle);
    const multiplier = BILLING_CYCLE_MULTIPLIERS[cycle] || 1;
    const now = new Date();
    const tempEndDate = new Date(now);
    tempEndDate.setDate(tempEndDate.getDate() + (targetPkg.durationDays || 0) * multiplier);

    const newSessions = (targetPkg.sessionCount || 0) * multiplier;
    const newClassCredits =
      targetPkg.classQuota === null || targetPkg.classQuota === undefined
        ? null
        : (targetPkg.classQuota || 0) * multiplier;

    user.membership = {
      packageId: targetPkg._id,
      startDate: now,
      endDate: tempEndDate,
      remainingSessions: newSessions,
      remainingClassCredits: newClassCredits,
      status: 'active',
      lastRenewalDate: now,
      billingCycle: cycle
    };

    user.membershipTemp = {
      isTemporary: true,
      packageId: targetPkg._id,
      startDate: now,
      endDate: tempEndDate,
      billingCycle: cycle,
      transactionId,
      restoreTo: backup
    };

    await user.save();

    logInfo(context, `Temporary upgrade activated for user ${userId}`, {
      from: backup.packageId?.toString?.(),
      to: targetPkg.name,
      transactionId,
      billingCycle: cycle,
      creditValue: quote.creditValue,
      amountDue: quote.amountDue,
      tempEndDate
    });

    return user.membership;
  } catch (error) {
    logError(context, 'Failed to temporary upgrade membership', error);
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
