/**
 * Test MongoDB Connection
 */
const mongoose = require('mongoose');
require('dotenv').config();

const testMongoConnection = async () => {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
    if (!process.env.MONGO_URI) {
      console.warn('⚠️  MONGO_URI not found in environment variables. Skipping MongoDB connection test.');
      process.exit(0);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully!');
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

testMongoConnection();
