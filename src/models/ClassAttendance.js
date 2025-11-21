const mongoose = require('mongoose');

const classAttendanceSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['staff', 'customer'],
    required: true
  },
  checkInAt: { type: Date, default: null },
  checkInMethod: {
    type: String,
    enum: ['qr', 'manual'],
    default: null
  },
  checkInToken: { type: String, trim: true },
  isLateCheckIn: {
    type: Boolean,
    default: false
  },
  checkInOffsetMinutes: {
    type: Number,
    default: 0
  },
  checkOutAt: { type: Date, default: null },
  checkOutMethod: {
    type: String,
    enum: ['qr', 'manual'],
    default: null
  },
  checkOutToken: { type: String, trim: true },
  isEarlyCheckOut: {
    type: Boolean,
    default: false
  },
  checkOutOffsetMinutes: {
    type: Number,
    default: 0
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null }
}, {
  timestamps: true
});

classAttendanceSchema.index({ classId: 1, userId: 1 }, { unique: true });
classAttendanceSchema.index({ role: 1, classId: 1 });

module.exports = mongoose.model('ClassAttendance', classAttendanceSchema);
