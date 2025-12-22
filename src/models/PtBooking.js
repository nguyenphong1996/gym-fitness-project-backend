const mongoose = require('mongoose');

const PtBookingSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true }, // normalized start-of-day (UTC)
  slotKey: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending_staff', 'confirmed', 'cancelled', 'completed', 'declined', 'cancelled_by_staff'],
    default: 'pending_staff',
    index: true
  },
  notes: { type: String, trim: true, maxlength: 500 },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelReason: { type: String, trim: true, maxlength: 200 },
  source: { type: String, enum: ['customer'], default: 'customer' },
  
  // Pricing info
  priceCharged: { type: Number, default: 0 }, // Số tiền thực tế phải trả (VND)
  discountPercent: { type: Number, default: 0, min: 0, max: 100 }, // % giảm giá từ membership
  usedMembershipSession: { type: Boolean, default: false }, // Có dùng lượt PT miễn phí không
  
  // Refund info (when cancelled)
  refundAmount: { type: Number, default: 0 }, // Số tiền hoàn lại (VND)
  refundPercent: { type: Number, default: 0, min: 0, max: 100 }, // % hoàn tiền
  sessionRestored: { type: Boolean, default: false }, // Có hoàn lượt miễn phí không
  
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
