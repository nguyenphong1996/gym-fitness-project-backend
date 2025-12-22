const mongoose = require('mongoose');

const MembershipPackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { 
    type: String, 
    enum: ['gym_access', 'class_access', 'pt_session', 'combo'], 
    required: true 
  },
  tier: { type: Number, default: 1, min: 1 }, // Dùng để xác định thứ hạng (chặn downgrade)
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 }, // Thời hạn sử dụng (ngày)
  sessionCount: { type: Number, default: 0 }, // Số buổi PT (nếu có)
  classQuota: { type: Number, default: 0, min: 0 }, // Số lượt class tặng (null/undefined = không giới hạn)
  classDiscountPercentAfterQuota: { type: Number, default: 0, min: 0, max: 100 }, // Giảm giá sau khi hết quota
  ptBookingDiscountPercent: { type: Number, default: 0, min: 0, max: 100 }, // Giảm giá PT booking sau khi hết lượt miễn phí
  
  // Facility Access Permissions
  facilityAccess: {
    gymFloor: { type: Boolean, default: true },
    swimmingPool: { type: Boolean, default: false },
    sauna: { type: Boolean, default: false },
    spa: { type: Boolean, default: false }
  },

  isActive: { type: Boolean, default: true }, // Trạng thái kinh doanh
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

MembershipPackageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MembershipPackage', MembershipPackageSchema);
