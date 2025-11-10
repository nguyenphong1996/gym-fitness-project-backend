const mongoose = require('mongoose');

// Subcategory mapping cho mỗi category
const SUBCATEGORY_MAP = {
  workout: ['Upper Body', 'Lower Body', 'Back', 'Legs', 'Full Body', 'Core', 'Chest', 'Shoulders', 'Arms', 'Glutes'],
  cardio: ['Running', 'Cycling', 'Jump Rope', 'HIIT', 'Dance', 'Swimming', 'Rowing', 'Elliptical'],
  stretching: ['Flexibility', 'Mobility', 'Dynamic Stretch', 'Static Stretch', 'Yoga Stretches', 'Recovery'],
  nutrition: ['Meal Prep', 'Recipes', 'Nutrition Tips', 'Supplements', 'Diet Plans', 'Hydration'],
  yoga: ['Hatha Yoga', 'Vinyasa Yoga', 'Power Yoga', 'Yin Yoga', 'Ashtanga Yoga', 'Beginner Yoga'],
  other: ['General', 'Tips', 'Motivation', 'Education']
};

// Lấy tất cả subcategories
const ALL_SUBCATEGORIES = Object.values(SUBCATEGORY_MAP).flat();

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
  subcategory: {
    type: String,
    enum: ALL_SUBCATEGORIES,
    trim: true
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
module.exports.SUBCATEGORY_MAP = SUBCATEGORY_MAP;
