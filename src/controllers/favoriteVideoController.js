const FavoriteVideo = require('../models/FavoriteVideo');
const Video = require('../models/Video');
const { validateObjectId } = require('../utils/validation');
const { getThumbnailUrl, getStreamingUrl } = require('../utils/cloudinary');
const { logError, logInfo, logWarning } = require('../utils/logger');

const buildFavoritePayload = (favoriteDoc, videoDoc) => {
  if (!favoriteDoc || !videoDoc) {
    return null;
  }

  return {
    favoriteId: favoriteDoc._id,
    videoId: videoDoc._id,
    title: videoDoc.title,
    thumbnail: getThumbnailUrl(videoDoc.cloudinary_id),
    streamingUrl: getStreamingUrl(videoDoc.cloudinary_id),
    duration: videoDoc.duration,
    estimatedCalories: videoDoc.estimated_calories,
    category: videoDoc.category,
    subcategory: videoDoc.subcategory,
    favoritedAt: favoriteDoc.createdAt
  };
};

exports.listFavorites = async (req, res) => {
  try {
    const favorites = await FavoriteVideo.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'videoId',
        select: 'title duration estimated_calories category subcategory cloudinary_id'
      });

    const data = favorites
      .map((favorite) => buildFavoritePayload(favorite, favorite.videoId))
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    logError('favoriteVideoController.listFavorites', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load favorite videos'
    });
  }
};

exports.markFavorite = async (req, res) => {
  try {
    const validation = validateObjectId(req.params.videoId, {
      fieldName: 'Video ID'
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        message: validation.message
      });
    }

    const video = await Video.findById(validation.id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    const existing = await FavoriteVideo.findOne({
      userId: req.user.id,
      videoId: video._id
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Video already in favorites',
        data: buildFavoritePayload(existing, video)
      });
    }

    const favorite = new FavoriteVideo({
      userId: req.user.id,
      videoId: video._id
    });
    await favorite.save();

    logInfo('favoriteVideoController.markFavorite', 'Video added to favorites', {
      userId: req.user.id,
      videoId: video._id
    });

    return res.status(201).json({
      success: true,
      message: 'Video added to favorites',
      data: buildFavoritePayload(favorite, video)
    });
  } catch (error) {
    if (error.code === 11000) {
      logWarning('favoriteVideoController.markFavorite', 'Duplicate favorite prevented', {
        userId: req.user.id,
        videoId: req.params.videoId
      });
      return res.status(200).json({
        success: true,
        message: 'Video already in favorites'
      });
    }

    logError('favoriteVideoController.markFavorite', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add video to favorites'
    });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const validation = validateObjectId(req.params.videoId, {
      fieldName: 'Video ID'
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        message: validation.message
      });
    }

    const removed = await FavoriteVideo.findOneAndDelete({
      userId: req.user.id,
      videoId: validation.id
    });

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found'
      });
    }

    logInfo('favoriteVideoController.removeFavorite', 'Video removed from favorites', {
      userId: req.user.id,
      videoId: validation.id
    });

    return res.status(200).json({
      success: true,
      message: 'Video removed from favorites'
    });
  } catch (error) {
    logError('favoriteVideoController.removeFavorite', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove video from favorites'
    });
  }
};
