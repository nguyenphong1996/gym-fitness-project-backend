const mongoose = require('mongoose');

const FacilitySchema = new mongoose.Schema({
  facilityCode: { type: String, required: true, unique: true, trim: true, index: true }, // e.g., 'gymFloor', 'swimmingPool'
  name: { type: String, required: true, trim: true }, // e.g., 'Phòng Tập Chính', 'Hồ Bơi'
  description: { type: String, trim: true },
  qrCodeData: { type: String, required: true, unique: true, trim: true }, // Dữ liệu trong mã QR
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

FacilitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Facility', FacilitySchema);
