require('dotenv').config();

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Video = require('../src/models/Video');
const FavoriteVideo = require('../src/models/FavoriteVideo');
const favoriteController = require('../src/controllers/favoriteVideoController');

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('gymxfit-favorites');
  await mongoose.connect(uri);

  const video = await Video.create({
    title: 'Test Workout',
    duration: 1200,
    estimated_calories: 320,
    category: 'workout',
    subcategory: 'Full Body',
    cloudinary_id: 'test/video/123',
    url: 'https://example.com/video.mp4'
  });

  const userId = new mongoose.Types.ObjectId().toString();
  console.log('\n🧪 [FAVORITES TEST] Start\n');

  // Create favorite
  const createRes = createMockRes();
  await favoriteController.markFavorite(
    { params: { videoId: video._id.toString() }, user: { id: userId } },
    createRes
  );

  if (createRes.statusCode !== 201 || !createRes.body?.success) {
    throw new Error('Failed to create favorite');
  }
  console.log('✅ Added video to favorites');

  // Prevent duplicates
  const duplicateRes = createMockRes();
  await favoriteController.markFavorite(
    { params: { videoId: video._id.toString() }, user: { id: userId } },
    duplicateRes
  );
  if (duplicateRes.statusCode !== 200 || !duplicateRes.body?.success) {
    throw new Error('Duplicate prevention failed');
  }
  console.log('✅ Duplicate favorite prevented');

  // List favorites
  const listRes = createMockRes();
  await favoriteController.listFavorites(
    { user: { id: userId } },
    listRes
  );
  if (!Array.isArray(listRes.body?.data) || listRes.body.data.length !== 1) {
    throw new Error('Favorites listing failed');
  }
  console.log('✅ Favorites listing works');

  // Remove favorite
  const removeRes = createMockRes();
  await favoriteController.removeFavorite(
    { params: { videoId: video._id.toString() }, user: { id: userId } },
    removeRes
  );
  if (removeRes.statusCode !== 200 || !removeRes.body?.success) {
    throw new Error('Failed to remove favorite');
  }
  console.log('✅ Removed favorite successfully');

  // Remove non-existing favorite
  const removeMissingRes = createMockRes();
  await favoriteController.removeFavorite(
    { params: { videoId: video._id.toString() }, user: { id: userId } },
    removeMissingRes
  );
  if (removeMissingRes.statusCode !== 404) {
    throw new Error('Removing missing favorite should return 404');
  }
  console.log('✅ Missing favorite removal guarded');

  // Ensure video existence validation
  const missingVideoRes = createMockRes();
  await favoriteController.markFavorite(
    { params: { videoId: new mongoose.Types.ObjectId().toString() }, user: { id: userId } },
    missingVideoRes
  );
  if (missingVideoRes.statusCode !== 404) {
    throw new Error('Video existence validation failed');
  }
  console.log('✅ Video existence validation works');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('\n✅ [FAVORITES TEST] All tests passed!\n');
  process.exit(0);
})().catch(async (error) => {
  console.error('❌ Favorites tests failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
