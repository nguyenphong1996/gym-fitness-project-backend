// models/OtpLog.js
const mongoose = require('mongoose');

const OtpLogSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  smsId: { type: String },
  apiResult: { type: Object },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  status: { type: String, enum: ['sent','verified','expired','failed'], default: 'sent' },
  attempts: { type: Number, default: 0 },
  ip: { type: String },
});

OtpLogSchema.index({ phone: 1, createdAt: -1 });

module.exports = mongoose.model('OtpLog', OtpLogSchema);
