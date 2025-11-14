const mongoose = require('mongoose');

const PtBookingSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true }, // normalized start-of-day (UTC)
  slotKey: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed', index: true },
  notes: { type: String, trim: true, maxlength: 500 },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, trim: true, maxlength: 200 },
  source: { type: String, enum: ['customer'], default: 'customer' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PtBookingSchema.index({ staffId: 1, startTime: 1 });
PtBookingSchema.index({ customerId: 1, startTime: 1 });
PtBookingSchema.index({ date: 1, slotKey: 1, staffId: 1 }, { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' } } });

PtBookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PtBooking', PtBookingSchema);
