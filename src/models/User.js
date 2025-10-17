// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  isVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['admin', 'staff', 'customer'], default: 'customer' },

  // Profile fields
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  avatar: {
    url: { type: String, trim: true },
    cloudinary_id: { type: String, trim: true }
  },
  gender: { type: String, enum: ['male', 'female', 'other'], trim: true }, // Giới tính
  dob: { type: Date },
  weight: { type: Number, min: 0, max: 100 }, // kg
  height: { type: Number, min: 0, max: 200 }, // cm

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', UserSchema);