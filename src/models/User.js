// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  isVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['admin', 'staff', 'customer'], default: 'customer' },

  // Profile fields
  name: { type: String, trim: true },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  }, // sparse for unique optional
  avatar: {
    url: { type: String, trim: true },
    cloudinary_id: { type: String, trim: true }
  },
  gender: { type: String, enum: ['male', 'female', 'other'], trim: true }, // Giới tính
  dob: { type: Date },
  weight: { type: Number, min: 0, max: 300 }, // kg
  height: { type: Number, min: 0, max: 250 }, // cm

  // PT (Staff) specific fields
  skills: { 
    type: [String], 
    enum: ['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other'],
    default: []
  },
  skillsApprovedByAdmin: { type: Boolean, default: false }, // Admin phải approve skills
  isActive: { type: Boolean, default: true }, // Kích hoạt/vô hiệu hóa tài khoản
  deactivatedAt: { type: Date }, // Thời điểm vô hiệu hóa (nếu có)
  certifications: [{
    name: { type: String },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    documentUrl: { type: String }
  }],
  hireDate: { type: Date }, // Ngày tuyển dụng PT
  skillUpdateRequest: {
    skills: [{
      type: String,
      enum: ['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other']
    }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: null },
    requestedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNote: { type: String, trim: true, maxlength: 500 }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', UserSchema);
