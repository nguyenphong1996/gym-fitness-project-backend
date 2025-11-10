const mongoose = require('mongoose');

const connectDB = async () => {
  // Skip MongoDB connection in CI/test environments without MONGO_URI
  if (!process.env.MONGO_URI) {
    console.log('⚠️ MONGO_URI not found - skipping MongoDB connection (CI mode)');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công!');
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error);
    // Exit on connection failure to fail fast in all environments
    process.exit(1);
  }
};

module.exports = connectDB;
