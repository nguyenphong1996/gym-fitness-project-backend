const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  // Thông tin cơ bản
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Phân loại
  category: {
    type: String,
    enum: ['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other'],
    required: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  
  // Mô tả chi tiết
  description: {
    type: String,
    trim: true
  },
  
  // Lịch học
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  
  // Thông tin lớp học
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  currentEnrollment: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Giảng viên
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Trạng thái lớp học
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Địa điểm
  location: {
    type: String,
    trim: true
  },
  
  // QR Code cho check-in
  qrCode: {
    url: { type: String, trim: true },
    cloudinary_id: { type: String, trim: true }
  },
  
  // Người tạo
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index cho tìm kiếm nhanh
classSchema.index({ staffId: 1, status: 1 });
classSchema.index({ category: 1 });
classSchema.index({ startTime: 1 });
classSchema.index({ createdBy: 1 });

// Auto update updatedAt trước khi save
classSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Class', classSchema);
