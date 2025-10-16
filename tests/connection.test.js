/**
 * Test MongoDB Connection
 */
const mongoose = require('mongoose');
require('dotenv').config();

const testMongoConnection = async () => {
  try {
    console.log('🔍 Testing MongoDB connection...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('❌ MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(process.env.MONGODB_URI);
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
