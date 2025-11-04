const Class = require('../models/Class');
const ClassAttendance = require('../models/ClassAttendance');

const COMPLETION_DELAY_MINUTES = (() => {
  const raw = parseInt(process.env.CLASS_COMPLETION_DELAY_MINUTES || '15', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 15;
})();

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const minutesToMillis = (minutes) => minutes * 60 * 1000;

const applyStatusIfChanged = async (classData, newStatus, now) => {
  if (!newStatus || newStatus === classData.status) {
    return classData.status;
  }

  classData.status = newStatus;
  classData.updatedAt = now;
  await classData.save();
  return classData.status;
};

const updateClassLifecycleStatus = async (classId, now = new Date()) => {
  const classData = await Class.findById(classId);
  if (!classData) {
    return null;
  }

  const staffAttendance = await ClassAttendance.findOne({
    classId: classData._id,
    role: 'staff'
  });

  const staffCheckedIn = Boolean(staffAttendance?.checkInAt);
  const staffCheckedOut = Boolean(staffAttendance?.checkOutAt);

  const customerCheckInFilter = {
    classId: classData._id,
    role: 'customer',
    checkInAt: { $ne: null }
  };

  const anyCustomerCheckedIn = await ClassAttendance.exists(customerCheckInFilter);

  const customerPendingCheckout = anyCustomerCheckedIn
    ? await ClassAttendance.exists({
        ...customerCheckInFilter,
        $or: [{ checkOutAt: null }, { checkOutAt: { $exists: false } }]
      })
    : false;

  const anyCustomerCheckedOut = anyCustomerCheckedIn
    ? await ClassAttendance.exists({
        classId: classData._id,
        role: 'customer',
        checkOutAt: { $ne: null }
      })
    : false;

  const endTime = toDate(classData.endTime);
  const completionThreshold = endTime
    ? new Date(endTime.getTime() + minutesToMillis(COMPLETION_DELAY_MINUTES))
    : null;

  let newStatus;

  if (!staffCheckedIn && !anyCustomerCheckedIn) {
    newStatus = endTime && now >= endTime ? 'expired' : classData.status === 'draft' ? 'draft' : 'scheduled';
  } else if (!staffCheckedIn && anyCustomerCheckedIn) {
    newStatus = endTime && now >= endTime ? 'expired' : 'waiting_pt';
  } else if (staffCheckedIn && !anyCustomerCheckedIn) {
    newStatus = endTime && now >= endTime ? 'expired' : 'on_going_waiting_customers';
  } else {
    // Staff & customers have checked in
    if (staffCheckedOut && !customerPendingCheckout && anyCustomerCheckedOut && completionThreshold && now >= completionThreshold) {
      newStatus = 'completed';
    } else if (staffCheckedOut && (!customerPendingCheckout || (completionThreshold && now >= completionThreshold && anyCustomerCheckedOut))) {
      newStatus = 'waiting_checkout';
    } else {
      newStatus = 'on_going';
    }

    if (endTime && now >= endTime) {
      if (staffCheckedOut && !customerPendingCheckout && anyCustomerCheckedOut && completionThreshold && now >= completionThreshold) {
        newStatus = 'completed';
      } else if (staffCheckedOut && !customerPendingCheckout) {
        newStatus = completionThreshold && now >= completionThreshold && anyCustomerCheckedOut
          ? 'completed'
          : 'waiting_checkout';
      } else {
        newStatus = 'overdue';
      }
    }
  }

  // Ensure waiting_checkout requires staff checkout
  if (newStatus === 'waiting_checkout' && !staffCheckedOut) {
    const overdueCondition = endTime && now >= endTime;
    newStatus = overdueCondition ? 'overdue' : 'on_going';
  }

  // Completed requires both sides to have checked out and at least one customer checkout
  if (
    newStatus === 'completed' &&
    (!staffCheckedOut || !anyCustomerCheckedOut || (completionThreshold && now < completionThreshold))
  ) {
    if (endTime && now >= endTime && (customerPendingCheckout || !anyCustomerCheckedOut)) {
      newStatus = 'overdue';
    } else {
      newStatus = staffCheckedOut ? 'waiting_checkout' : 'on_going';
    }
  }

  // Expire scenarios when time has passed without necessary check-ins
  if (
    ['scheduled', 'waiting_pt', 'on_going_waiting_customers'].includes(newStatus) &&
    endTime &&
    now >= endTime
  ) {
    if (!staffCheckedIn && !anyCustomerCheckedIn) {
      newStatus = 'expired';
    } else if (!staffCheckedIn && anyCustomerCheckedIn) {
      newStatus = 'expired';
    } else if (staffCheckedIn && !anyCustomerCheckedIn) {
      newStatus = 'expired';
    }
  }

  return applyStatusIfChanged(classData, newStatus, now);
};

const evaluateClassesForBackground = async (now = new Date()) => {
  const candidates = await Class.find({
    status: {
      $in: [
        'scheduled',
        'waiting_pt',
        'on_going_waiting_customers',
        'on_going',
        'waiting_checkout',
        'overdue'
      ]
    }
  }).select('_id');

  for (const classDoc of candidates) {
    // eslint-disable-next-line no-await-in-loop
    await updateClassLifecycleStatus(classDoc._id, now);
  }
};

module.exports = {
  COMPLETION_DELAY_MINUTES,
  updateClassLifecycleStatus,
  evaluateClassesForBackground
};
