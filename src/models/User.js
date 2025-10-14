// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  isVerified: { type: Boolean, default: false },

  // Profile fields
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  avatarUrl: { type: String, trim: true },
  dob: { type: Date },
  weight: { type: Number }, // kg
  height: { type: Number }, // meters or cm as your app expects

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', UserSchema);