const mongoose = require('mongoose');

const paymentTokenSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  token: { type: String, required: true },
  cardMask: { type: String, default: null },
  cardType: { type: String, default: null }, // 01: nội địa, 02: quốc tế
  bankCode: { type: String, default: null },
  tmnCode: { type: String, default: null },
  isDefault: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

paymentTokenSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PaymentToken', paymentTokenSchema);
