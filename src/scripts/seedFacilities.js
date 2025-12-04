require('dotenv').config();
const mongoose = require('mongoose');
const Facility = require('../models/Facility');
const connectDB = require('../config/db');

const facilities = [
  {
    facilityCode: 'gymFloor',
    name: 'Phòng Tập Chính',
    description: 'Khu vực tập luyện chung với đầy đủ máy móc cardio và tạ.',
    qrCodeData: 'gym_floor_access_code',
    isActive: true
  },
  {
    facilityCode: 'swimmingPool',
    name: 'Hồ Bơi',
    description: 'Hồ bơi 4 mùa tiêu chuẩn Olympic.',
    qrCodeData: 'swimming_pool_access_code',
    isActive: true
  },
  {
    facilityCode: 'sauna',
    name: 'Phòng Xông Hơi',
    description: 'Khu vực xông hơi khô và ướt thư giãn.',
    qrCodeData: 'sauna_access_code',
    isActive: true
  },
  {
    facilityCode: 'spa',
    name: 'Khu Vực Spa',
    description: 'Dịch vụ Spa và trị liệu cao cấp.',
    qrCodeData: 'spa_access_code',
    isActive: true
  }
];

const seedFacilities = async () => {
  try {
    await connectDB();

    console.log('Clearing existing facilities...');
    await Facility.deleteMany({});

    console.log('Seeding new facilities...');
    await Facility.insertMany(facilities);

    console.log('Facilities seeded successfully:');
    facilities.forEach(f => console.log(`- ${f.name} (${f.facilityCode})`));

    process.exit(0);
  } catch (error) {
    console.error('Error seeding facilities:', error);
    process.exit(1);
  }
};

seedFacilities();
