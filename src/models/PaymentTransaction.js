const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
  txnRef: { type: String, required: true, index: true },
  channel: { type: String, enum: ['vnpay_pay', 'vnpay_token_create', 'vnpay_pay_and_create', 'vnpay_token_pay'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
  orderInfo: { type: String },
  amount: { type: Number, default: 0 }, // đơn vị VND, chưa nhân 100
  currency: { type: String, default: 'VND' },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending', index: true },
  responseCode: { type: String, default: null },
  transactionStatus: { type: String, default: null },
  vnpTransactionNo: { type: String, default: null },
  bankCode: { type: String, default: null },
  cardType: { type: String, default: null },
  token: { type: String, default: null }, // token trả về từ VNPAY (masked)
  rawReturnParams: { type: Object, default: {} },
  rawIpnParams: { type: Object, default: {} },
  paidAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

paymentTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
