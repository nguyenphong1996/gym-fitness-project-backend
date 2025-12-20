const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'booking_pt',
      'booking_class',
      'cancel_booking_pt',
      'cancel_booking_class',
      'checkin',
      'checkout',
      'membership_upgrade',
      'membership_activate',
      'membership_upgrade_temp',
      'membership_renew',
      'favorite_add',
      'favorite_remove',
      'profile_update',
      'login',
      'logout',
      'payment_success',
      'payment_failed',
    ],
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    device: String,
    platform: String,
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ userId: 1, type: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
