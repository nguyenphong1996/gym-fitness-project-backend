const fs = require('fs').promises;
const Video = require('../models/Video');
const { SUBCATEGORY_MAP } = require('../models/Video');
const { uploadVideo, getThumbnailUrl, getStreamingUrl, deleteVideo } = require('../utils/cloudinary');
const { logError, logSuccess, logInfo, logVideoUpload } = require('../utils/logger');

// Validate subcategory có match với category không
const validateSubcategory = (category, subcategory) => {
  if (!subcategory) return false;
  const allowedSubcategories = SUBCATEGORY_MAP[category] || [];
  return allowedSubcategories.includes(subcategory);
};

const uploadVideoFile = async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Video file required' });
    }

    filePath = req.file.path;
    const { title, estimated_calories, category, subcategory } = req.body;
    
    if (!title || !estimated_calories || !subcategory) {
      await fs.unlink(filePath).catch(() => {});
      return res.status(400).json({ success: false, message: 'Title, estimated_calories, and subcategory required' });
    }

    const finalCategory = category || 'workout';
    
    // Validate subcategory match với category
    if (!validateSubcategory(finalCategory, subcategory)) {
      await fs.unlink(filePath).catch(() => {});
      const allowedSubs = SUBCATEGORY_MAP[finalCategory].join(', ');
      return res.status(400).json({ 
        success: false, 
        message: `Invalid subcategory for "${finalCategory}". Allowed: ${allowedSubs}` 
      });
    }

    // 📤 Log: Bắt đầu upload
    logVideoUpload('pending', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      title,
      category: finalCategory,
      subcategory: subcategory
    });

    // 🔄 Log: Đang xử lý
    logVideoUpload('processing', {
      title,
      category: finalCategory,
      subcategory: subcategory
    });

    const uploadResult = await uploadVideo(filePath);

    const video = new Video({
      title,
      duration: uploadResult.duration,
      estimated_calories: parseInt(estimated_calories),
      category: finalCategory,
      subcategory: subcategory,
      cloudinary_id: uploadResult.cloudinary_id,
      url: uploadResult.url
    });

    await video.save();

    // ✅ Log: Upload thành công
    logVideoUpload('completed', {
      title: video.title,
      duration: video.duration,
      category: video.category,
      subcategory: video.subcategory,
      cloudinary_id: video.cloudinary_id,
      url: video.url
    });

    // Xóa file tạm sau upload thành công
    await fs.unlink(filePath).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Video uploaded',
      video: {
        id: video._id,
        title: video.title,
        duration: video.duration,
        estimated_calories: video.estimated_calories,
        category: video.category,
        subcategory: video.subcategory
      }
    });
  } catch (error) {
    // ❌ Log: Upload lỗi
    logVideoUpload('failed', {
      fileName: req.file?.originalname,
      error: error.message
    });
    
    // Xóa file tạm nếu lỗi
    if (filePath) {
      await fs.unlink(filePath).catch(() => {});
    }
    logError('❌ Upload error', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
};

const getAllVideos = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, subcategory, search } = req.query;
    
    const query = {};
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (search) query.$text = { $search: search };

    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Video.countDocuments(query);

    const videosWithThumbnails = videos.map(video => ({
      id: video._id,
      title: video.title,
      thumbnail: getThumbnailUrl(video.cloudinary_id),
      duration: video.duration,
      estimated_calories: video.estimated_calories,
      category: video.category,
      subcategory: video.subcategory,
      views: video.views
    }));

    res.json({
      success: true,
      videos: videosWithThumbnails,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    logError('❌ Get videos error', error);
    res.status(500).json({ success: false, message: 'Get videos failed' });
  }
};

const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    video.views += 1;
    await video.save();

    // 👁️ Log: Views tracking
    logVideoUpload('completed', {
      title: video.title,
      views: video.views
    });

    res.json({
      success: true,
      video: {
        id: video._id,
        title: video.title,
        thumbnail: getThumbnailUrl(video.cloudinary_id),
        streaming_url: getStreamingUrl(video.cloudinary_id),
        duration: video.duration,
        estimated_calories: video.estimated_calories,
        category: video.category,
        subcategory: video.subcategory,
        views: video.views
      }
    });
  } catch (error) {
    logError('❌ Get video error', error);
    res.status(500).json({ success: false, message: 'Get video failed' });
  }
};

const deleteVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    await deleteVideo(video.cloudinary_id);
    await Video.findByIdAndDelete(req.params.id);

    logSuccess(`✅ Video deleted: ${video._id}`);

    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    logError('❌ Delete error', error);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};

// Lấy danh sách subcategories theo category
const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    if (!SUBCATEGORY_MAP[category]) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid category. Valid categories: ${Object.keys(SUBCATEGORY_MAP).join(', ')}` 
      });
    }

    const subcategories = SUBCATEGORY_MAP[category];
    
    res.json({
      success: true,
      category: category,
      subcategories: subcategories
    });
  } catch (error) {
    logError('❌ Get subcategories error', error);
    res.status(500).json({ success: false, message: 'Get subcategories failed' });
  }
};

module.exports = { uploadVideoFile, getAllVideos, getVideoById, deleteVideoById, getSubcategoriesByCategory };
