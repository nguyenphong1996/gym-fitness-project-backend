const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { logError, logSuccess, logInfo } = require('./logger');

cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL
});

const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const DEFAULT_CHUNK_SIZE_BYTES = 6 * 1024 * 1024; // 6MB chunks keep memory low on free tier
const DEFAULT_RETRY_ATTEMPTS = Number(process.env.CLOUDINARY_RETRY_ATTEMPTS || 3);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.CLOUDINARY_RETRY_DELAY_MS || 1000);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error = {}) => {
  const retryableHttpCodes = [408, 420, 423, 429, 500, 502, 503, 504, 524];
  if (retryableHttpCodes.includes(error.http_code)) return true;

  const message = String(error.message || error?.error?.message || '').toLowerCase();
  return [
    'timeout',
    'timed out',
    'socket hang up',
    'connection reset',
    'econnreset',
    'eai_again',
    'etimedout',
    'temporary failure',
    'rate limit',
    'service unavailable'
  ].some((fragment) => message.includes(fragment));
};

const withRetry = async (operationName, fn, attempts = DEFAULT_RETRY_ATTEMPTS) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts;
      if (!shouldRetry(error) || isLastAttempt) {
        throw error;
      }

      const retryDelay = DEFAULT_RETRY_DELAY_MS * attempt;
      logInfo(
        'cloudinary',
        `${operationName} attempt ${attempt} failed (${error.message || error}). Retrying in ${retryDelay}ms`
      );
      await delay(retryDelay);
    }
  }

  throw lastError;
};

/**
 * Uploads an image file to Cloudinary.
 * @param {string} filePath - The local path to the image file.
 * @returns {Promise<object>} Object containing the public_id and secure_url of the uploaded image.
 */
const uploadImage = async (filePath) => {
  try {
    const result = await withRetry('image upload', () => {
      logInfo('cloudinary', `Uploading image: ${filePath}`);
      return cloudinary.uploader.upload(filePath, {
        resource_type: 'image',
        folder: 'gymxfit/avatars',
        transformation: [
          { width: 250, height: 250, gravity: 'face', crop: 'thumb' },
          { fetch_format: 'auto' }
        ]
      });
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

  return withRetry('image buffer upload', () => new Promise((resolve, reject) => {
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
        return reject(error);
      }

      logSuccess('cloudinary', `Image buffer uploaded: ${result.public_id}`);
      resolve({
        cloudinary_id: result.public_id,
        url: result.secure_url
      });
    });

    stream.end(buffer);
  })).catch((error) => {
    logError('cloudinary', 'Image buffer upload failed', error);
    throw error;
  });
};

/**
 * Uploads a video file to Cloudinary for HLS streaming.
 * @param {string} filePath - The local path to the video file.
 * @returns {Promise<object>} Object containing details of the uploaded video.
 */
const uploadVideo = async (filePath, options = {}) => {
  const {
    folder = 'gymxfit/videos',
    public_id,
    overwrite = true,
    chunk_size = DEFAULT_CHUNK_SIZE_BYTES,
    use_filename = true,
    unique_filename = true,
    resource_type = 'video'
  } = options;

  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size > MAX_VIDEO_SIZE_BYTES) {
      const error = new Error(
        `Video file is ${(stats.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed size is ${MAX_VIDEO_SIZE_MB}MB for the current Cloudinary plan.`
      );
      error.code = 'VIDEO_SIZE_EXCEEDED';
      throw error;
    }

    const result = await withRetry('video upload', (attempt) => new Promise((resolve, reject) => {
      logInfo('cloudinary', `Uploading video (attempt ${attempt}): ${filePath}`);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type,
          folder,
          overwrite,
          public_id,
          use_filename,
          unique_filename,
          // Avoid eager HLS transformations by default to save credits.
          eager: options.eager,
          eager_async: options.eager_async,
          context: options.context,
          tags: options.tags,
          transformation: options.transformation
        },
        (error, uploadResult) => {
          if (error) {
            return reject(error);
          }
          resolve(uploadResult);
        }
      );

      uploadStream.on('error', reject);

      const readStream = fs.createReadStream(filePath, { highWaterMark: chunk_size });
      readStream.on('error', (streamError) => {
        uploadStream.destroy(streamError);
        reject(streamError);
      });

      readStream.pipe(uploadStream);
    }));

    logSuccess('cloudinary', `Video uploaded: ${result.public_id}`);
    return {
      cloudinary_id: result.public_id,
      url: result.secure_url,
      duration: result.duration,
      bytes: result.bytes
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
    const result = await cloudinary.uploader.destroy(cloudinary_id, { resource_type });

    if (result.result === 'not found') {
      logInfo('cloudinary', `${resource_type} not found, skip delete: ${cloudinary_id}`);
      return;
    }

    if (result.result !== 'ok') {
      logInfo('cloudinary', `Unexpected delete response for ${resource_type} ${cloudinary_id}: ${result.result}`);
      return;
    }

    logSuccess('cloudinary', `Deleted ${resource_type}: ${cloudinary_id}`);
  } catch (error) {
    logError('cloudinary', `Failed to delete ${resource_type}: ${cloudinary_id}`, error);
    // We don't re-throw the error because failing to delete an old asset shouldn't block the main operation.
  }
};

const deleteVideo = async (cloudinary_id) => {
  await deleteResource(cloudinary_id, 'video');
};

const getThumbnailUrl = (cloudinary_id, options = {}) => {
  if (!cloudinary_id) return null;

  const {
    width = 300,
    height = 200,
    start_offset = 'auto',
    quality = 'auto',
    secure = true
  } = options;

  return cloudinary.url(cloudinary_id, {
    resource_type: 'video',
    format: 'jpg',
    secure,
    transformation: [
      {
        start_offset,
        width,
        height,
        crop: 'fill',
        gravity: 'auto',
        quality
      }
    ]
  });
};

const getStreamingUrl = (cloudinary_id, options = {}) => {
  if (!cloudinary_id) return null;

  const {
    streaming_profile = process.env.CLOUDINARY_STREAMING_PROFILE || 'sd',
    secure = true,
    format = 'm3u8',
    transformation
  } = options;

  return cloudinary.url(cloudinary_id, {
    resource_type: 'video',
    streaming_profile,
    format,
    secure,
    transformation
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
