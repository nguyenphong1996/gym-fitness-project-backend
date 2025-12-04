const mongoose = require('mongoose');

const FacilityCheckinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  facilityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  facilityCode: { type: String, required: true, index: true }, // Lưu dư thừa để query nhanh
  checkinTime: { type: Date, default: Date.now, index: true },
  isSuccessful: { type: Boolean, default: true }, // Có thể dùng để log cả những lần thất bại nếu muốn mở rộng sau này
  failReason: { type: String } // Lý do thất bại (nếu có)
});

module.exports = mongoose.model('FacilityCheckin', FacilityCheckinSchema);
