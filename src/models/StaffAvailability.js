const mongoose = require('mongoose');

const StaffAvailabilitySchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true }, // normalized start-of-day (UTC)
  slots: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

StaffAvailabilitySchema.index({ staffId: 1, date: 1 }, { unique: true });

StaffAvailabilitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('StaffAvailability', StaffAvailabilitySchema);
