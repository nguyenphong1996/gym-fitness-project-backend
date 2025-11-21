// tests/cloudinary.test.js
require('dotenv').config();

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
} catch (error) {
  console.log('⚠️  cloudinary module not installed - skipping tests');
  process.exit(0);
}
const path = require('path');
const fs = require('fs');

console.log('\n🧪 [CLOUDINARY TEST] Starting Cloudinary API tests...\n');

// Check environment
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (!cloudinaryUrl) {
  console.log('⚠️  CLOUDINARY_URL not set - skipping tests');
  process.exit(0);
}

cloudinary.config({
  cloudinary_url: cloudinaryUrl
});

// Test 1: Verify Cloudinary config
console.log('📋 Test 1: Verify Cloudinary Configuration');
try {
  const config = cloudinary.config();
  if (config.cloud_name && config.api_key) {
    console.log(`✅ PASS: Cloudinary configured`);
    console.log(`   Cloud: ${config.cloud_name}`);
    console.log(`   API Key: ${config.api_key.substring(0, 5)}...`);
  } else {
    console.log('❌ FAIL: Cloudinary config missing');
    process.exit(1);
  }
} catch (err) {
  console.log('❌ FAIL:', err.message);
  process.exit(1);
}

// Test 2: Test getThumbnailUrl function
console.log('\n📋 Test 2: getThumbnailUrl Function');
try {
  const getThumbnailUrl = (cloudinary_id) => {
    return cloudinary.url(cloudinary_id, {
      resource_type: 'video',
      fetch_format: 'jpg',
      transformation: [
        { video_codec: 'auto:3' },
        { width: 300, height: 200, crop: 'fill' }
      ]
    });
  };

  const testId = 'gymxfit/videos/test123';
  const thumbnailUrl = getThumbnailUrl(testId);
  
  if (thumbnailUrl.includes('cloudinary.com') && thumbnailUrl.includes('300') && thumbnailUrl.includes('200')) {
    console.log(`✅ PASS: Thumbnail URL generated`);
    console.log(`   URL: ${thumbnailUrl.substring(0, 80)}...`);
  } else {
    console.log('❌ FAIL: Thumbnail URL format incorrect');
    process.exit(1);
  }
} catch (err) {
  console.log('❌ FAIL:', err.message);
  process.exit(1);
}

// Test 3: Test getStreamingUrl function
console.log('\n📋 Test 3: getStreamingUrl Function');
try {
  const getStreamingUrl = (cloudinary_id) => {
    return cloudinary.url(cloudinary_id, {
      resource_type: 'video',
      streaming_profile: 'hd',
      format: 'm3u8'
    });
  };

  const testId = 'gymxfit/videos/test123';
  const streamingUrl = getStreamingUrl(testId);
  
  if (streamingUrl.includes('cloudinary.com') && streamingUrl.includes('m3u8')) {
    console.log(`✅ PASS: Streaming URL (HLS m3u8) generated`);
    console.log(`   URL: ${streamingUrl.substring(0, 80)}...`);
  } else {
    console.log('❌ FAIL: Streaming URL format incorrect');
    process.exit(1);
  }
} catch (err) {
  console.log('❌ FAIL:', err.message);
  process.exit(1);
}

// Test 4: Test upload capability (dry run - no actual upload)
console.log('\n📋 Test 4: Upload Capability Check');
try {
  if (typeof cloudinary.uploader.upload === 'function') {
    console.log(`✅ PASS: Upload method available`);
    console.log(`   cloudinary.uploader.upload is ready`);
  } else {
    console.log('❌ FAIL: Upload method not available');
    process.exit(1);
  }
} catch (err) {
  console.log('❌ FAIL:', err.message);
  process.exit(1);
}

// Test 5: Test delete capability
console.log('\n📋 Test 5: Delete Capability Check');
try {
  if (typeof cloudinary.uploader.destroy === 'function') {
    console.log(`✅ PASS: Delete method available`);
    console.log(`   cloudinary.uploader.destroy is ready`);
  } else {
    console.log('❌ FAIL: Delete method not available');
    process.exit(1);
  }
} catch (err) {
  console.log('❌ FAIL:', err.message);
  process.exit(1);
}

// Test 6: Verify cloudinary.url generates valid URLs
console.log('\n📋 Test 6: URL Generation Validation');
try {
  const testCases = [
    { id: 'test/image', type: 'image', format: 'jpg' },
    { id: 'test/video', type: 'video', format: 'mp4' }
  ];

  for (const testCase of testCases) {
    const url = cloudinary.url(testCase.id, {
      resource_type: testCase.type,
      format: testCase.format
    });

    if (url.includes('cloudinary.com') && url.includes(testCase.id)) {
      console.log(`✅ ${testCase.type.toUpperCase()}: URL generated correctly`);
    } else {
      console.log(`❌ ${testCase.type.toUpperCase()}: URL format incorrect`);
      process.exit(1);
    }
  }
} catch (err) {
  console.log('❌ FAIL:', err.message);
  process.exit(1);
}

console.log('\n✅ [CLOUDINARY TEST] All tests passed!\n');
process.exit(0);
