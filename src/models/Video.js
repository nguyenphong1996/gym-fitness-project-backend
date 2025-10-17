const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true
  },
  estimated_calories: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['workout', 'nutrition', 'stretching', 'cardio', 'yoga', 'other'],
    default: 'workout'
  },
  cloudinary_id: {
    type: String,
    required: true,
    unique: true
  },
  url: {
    type: String,
    required: true
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

videoSchema.index({ title: 'text' });
videoSchema.index({ category: 1 });

module.exports = mongoose.model('Video', videoSchema);
