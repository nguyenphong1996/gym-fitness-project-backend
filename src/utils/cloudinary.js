const cloudinary = require('cloudinary').v2;
const { logError, logSuccess, logInfo } = require('./logger');

cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL
});

/**
 * Uploads an image file to Cloudinary.
 * @param {string} filePath - The local path to the image file.
 * @returns {Promise<object>} Object containing the public_id and secure_url of the uploaded image.
 */
const uploadImage = async (filePath) => {
  try {
    logInfo('cloudinary', `Uploading image: ${filePath}`);
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'image',
      folder: 'gymxfit/avatars',
      transformation: [
        { width: 250, height: 250, gravity: 'face', crop: 'thumb' },
        { fetch_format: 'auto' }
      ]
    });
    logSuccess('cloudinary', `Image uploaded: ${result.public_id}`);
    return {
      cloudinary_id: result.public_id,
      url: result.secure_url
    };
  } catch (error) {
    logError('cloudinary', 'Image upload failed', error);
    throw error;
  }
};

/**
 * Upload an image buffer (useful for dynamically generated assets like QR codes)
 * @param {Buffer} buffer
 * @param {object} options
 * @returns {Promise<object>}
 */
const uploadImageBuffer = async (buffer, options = {}) => {
  const {
    folder = 'gymxfit/avatars',
    public_id,
    overwrite = true,
    format = 'png'
  } = options;

  return new Promise((resolve, reject) => {
    logInfo('cloudinary', `Uploading image buffer to folder ${folder}`);

    const uploadOptions = {
      resource_type: 'image',
      folder,
      overwrite,
      format,
      public_id,
      transformation: options.transformation || [
        { fetch_format: 'auto' }
      ]
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        logError('cloudinary', 'Image buffer upload failed', error);
        return reject(error);
      }

      logSuccess('cloudinary', `Image buffer uploaded: ${result.public_id}`);
      resolve({
        cloudinary_id: result.public_id,
        url: result.secure_url
      });
    });

    stream.end(buffer);
  });
};

/**
 * Uploads a video file to Cloudinary for HLS streaming.
 * @param {string} filePath - The local path to the video file.
 * @returns {Promise<object>} Object containing details of the uploaded video.
 */
const uploadVideo = async (filePath) => {
  try {
    logInfo('cloudinary', `Uploading video: ${filePath}`);
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      folder: 'gymxfit/videos',
      eager: [{ streaming_profile: 'hd', format: 'm3u8' }],
      eager_async: true
    });
    logSuccess('cloudinary', `Video uploaded: ${result.public_id}`);
    return {
      cloudinary_id: result.public_id,
      url: result.secure_url,
      duration: result.duration
    };
  } catch (error) {
    logError('cloudinary', 'Video upload failed', error);
    throw error;
  }
};

/**
 * Deletes a resource from Cloudinary.
 * @param {string} cloudinary_id - The public ID of the resource to delete.
 * @param {string} resource_type - The type of the resource ('image', 'video').
 */
const deleteResource = async (cloudinary_id, resource_type = 'image') => {
  if (!cloudinary_id) return;
  try {
    await cloudinary.uploader.destroy(cloudinary_id, { resource_type });
    logSuccess('cloudinary', `Deleted ${resource_type}: ${cloudinary_id}`);
  } catch (error) {
    logError('cloudinary', `Failed to delete ${resource_type}: ${cloudinary_id}`, error);
    // We don't re-throw the error because failing to delete an old asset shouldn't block the main operation.
  }
};

const deleteVideo = async (cloudinary_id) => {
  await deleteResource(cloudinary_id, 'video');
};

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

const getStreamingUrl = (cloudinary_id) => {
  return cloudinary.url(cloudinary_id, {
    resource_type: 'video',
    streaming_profile: 'hd',
    format: 'm3u8'
  });
};

module.exports = { 
  uploadImage, 
  uploadImageBuffer,
  uploadVideo, 
  deleteResource, 
  deleteVideo,
  getThumbnailUrl, 
  getStreamingUrl 
};
