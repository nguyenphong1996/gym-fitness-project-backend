const mongoose = require('mongoose');

const MembershipPackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { 
    type: String, 
    enum: ['class_access', 'pt_session', 'combo'], 
    required: true 
  },
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 }, // Thời hạn sử dụng (ngày)
  sessionCount: { type: Number, default: 0 }, // Số buổi PT (nếu có)
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
