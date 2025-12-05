require('dotenv').config();
const MembershipPackage = require('../models/MembershipPackage');
const connectDB = require('../config/db');

const packages = [
  {
    name: 'Basic',
    tier: 1,
    price: 690000,
    durationDays: 30,
    type: 'gym_access',
    sessionCount: 0,
    classQuota: 0,
    classDiscountPercentAfterQuota: 0,
    description:
      'Không giới hạn khu cardio/tạ/máy; locker tiêu chuẩn; không gồm lớp nhóm hay ưu đãi PT; không khăn/nước miễn phí.',
    facilityAccess: {
      gymFloor: true,
      swimmingPool: false,
      sauna: false,
      spa: false,
    },
  },
  {
    name: 'Plus',
    tier: 2,
    price: 890000,
    durationDays: 30,
    type: 'class_access', // Bao gồm gym + lớp
    sessionCount: 2, // Tặng 2 buổi PT định hướng
    classQuota: 5, // Tặng 5 lượt class
    classDiscountPercentAfterQuota: 20, // Hết quota giảm 20%
    description:
      'Gồm toàn bộ quyền lợi Basic; tham gia & đặt chỗ lớp không giới hạn trên app; tặng 2 buổi PT định hướng; tặng 5 lượt class/tháng; hết quota giảm 20% phí class; có nước uống miễn phí.',
    facilityAccess: {
      gymFloor: true,
      swimmingPool: false,
      sauna: true,
      spa: false,
    },
  },
  {
    name: 'Premium',
    tier: 3,
    price: 1290000,
    durationDays: 30,
    type: 'combo', // Gym + Lớp + PT + Ưu đãi
    sessionCount: 5, // Tặng 5 buổi PT mỗi tháng
    classQuota: null, // Không giới hạn class
    classDiscountPercentAfterQuota: 0,
    description:
      'Gồm toàn bộ quyền lợi Plus; khăn & nước/đồ uống miễn phí; locker VIP; tặng 5 buổi PT mỗi tháng; class không giới hạn; giảm 10–20% khi mua gói PT; giảm 20% phí booking PT.',
    facilityAccess: {
      gymFloor: true,
      swimmingPool: true,
      sauna: true,
      spa: true,
    },
  },
];

const seedPackages = async () => {
  try {
    await connectDB();

    console.log('Clearing existing packages...');
    await MembershipPackage.deleteMany({});

    console.log('Seeding new packages...');
    await MembershipPackage.insertMany(packages);

    console.log('Packages seeded successfully:');
    packages.forEach((p) => console.log(`- ${p.name}: ${p.price.toLocaleString()} VND`));

    process.exit(0);
  } catch (error) {
    console.error('Error seeding packages:', error);
    process.exit(1);
  }
};

seedPackages();
