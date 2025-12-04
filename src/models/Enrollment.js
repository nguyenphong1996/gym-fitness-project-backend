const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  // Thông tin enrollment
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  
  // Trạng thái
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  
  // Thời gian
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  
  cancelledAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  },

  // Pricing info
  priceCharged: { type: Number, default: 0 }, // VND
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  usedClassCredit: { type: Boolean, default: false },
  
  // Lý do hủy (nếu có)
  cancellationReason: {
    type: String,
    trim: true,
    default: null
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index để tìm kiếm nhanh
enrollmentSchema.index({ userId: 1, status: 1 });
enrollmentSchema.index({ classId: 1, status: 1 });
enrollmentSchema.index({ enrolledAt: 1 });
enrollmentSchema.index({ userId: 1, classId: 1 }, { unique: true }); // Không thể đăng ký 2 lần

// Auto update updatedAt trước khi save
enrollmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
