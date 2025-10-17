const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadVideoFile, getAllVideos, getVideoById, deleteVideoById } = require('../controllers/videoController');

// Tạo thư mục tạm nếu không tồn tại
const uploadDir = path.join('/tmp', 'gymxfit-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files allowed (MP4, MOV, WEBM)'), false);
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }
});

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: Quản lý video workout, streaming HLS
 */

/**
 * @swagger
 * /api/videos/upload:
 *   post:
 *     summary: Upload video mới (Admin only)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Upload video workout lên Cloudinary với hỗ trợ HLS streaming.
 *       
 *       **File Requirements:**
 *       - Định dạng: MP4, MOV, WEBM
 *       - Kích thước: Tối đa 100MB
 *       - Sẽ tự động trích thumbnail tại giây thứ 3
 *       
 *       **Yêu cầu:** Phải đăng nhập và là Admin
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *               - title
 *               - duration
 *               - estimated_calories
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: File video (MP4, MOV, WEBM), max 100MB
 *               title:
 *                 type: string
 *                 example: "Full Body HIIT Workout - 30 minutes"
 *                 description: Tên video
 *               duration:
 *                 type: number
 *                 example: 1800
 *                 description: Thời lượng video (giây)
 *               estimated_calories:
 *                 type: number
 *                 example: 350
 *                 description: Ước tính kcal đốt cháy
 *               category:
 *                 type: string
 *                 enum: [workout, nutrition, stretching, cardio, yoga, other]
 *                 example: cardio
 *                 description: Loại video
 *     responses:
 *       201:
 *         description: Upload thành công, video sẵn sàng stream
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Video uploaded successfully"
 *                 video:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "68eff234c8db2a37df681570"
 *                     title:
 *                       type: string
 *                     cloudinary_id:
 *                       type: string
 *                       description: ID video tại Cloudinary
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: URL video gốc
 *                     thumbnail:
 *                       type: string
 *                       format: uri
 *                       description: URL thumbnail (frame @3s, 300x200)
 *                     duration:
 *                       type: number
 *                     estimated_calories:
 *                       type: number
 *                     category:
 *                       type: string
 *                     views:
 *                       type: number
 *                       example: 0
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error hoặc file không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_fields, invalid_file, file_too_large, unsupported_format]
 *                   example: "missing_fields"
 *                 message:
 *                   type: string
 *                   example: "Missing required fields: title, duration, estimated_calories"
 *       401:
 *         description: Không có authorization hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_token, invalid_token, expired_token]
 *                   example: "missing_token"
 *                 message:
 *                   type: string
 *                   example: "Authorization header required"
 *       500:
 *         description: Lỗi server hoặc upload Cloudinary thất bại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [cloudinary_error, database_error, server_error]
 *                   example: "cloudinary_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to upload video to Cloudinary"
 */
router.post('/upload', authMiddleware, upload.single('video'), uploadVideoFile);

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: Lấy danh sách videos (có pagination, filter, search)
 *     tags: [Videos]
 *     description: |
 *       Danh sách tất cả videos với hỗ trợ:
 *       - **Pagination:** page, limit
 *       - **Filter:** category (workout, nutrition, stretching, cardio, yoga, other)
 *       - **Search:** Tìm kiếm theo title (text index)
 *       - **Sorting:** Mới nhất lên trước
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số video mỗi trang (1-50)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [workout, nutrition, stretching, cardio, yoga, other]
 *         description: Lọc theo loại video
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo title (ví dụ - HIIT, Yoga)
 *     responses:
 *       200:
 *         description: Danh sách videos với thumbnail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 videos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "68eff234c8db2a37df681570"
 *                       title:
 *                         type: string
 *                       category:
 *                         type: string
 *                       duration:
 *                         type: number
 *                       estimated_calories:
 *                         type: number
 *                       thumbnail:
 *                         type: string
 *                         format: uri
 *                         description: URL thumbnail 300x200
 *                       views:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 45
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     pages:
 *                       type: number
 *                       example: 5
 *       400:
 *         description: Validation error (page, limit không hợp lệ)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [invalid_page, invalid_limit, invalid_category]
 *                   example: "invalid_limit"
 *                 message:
 *                   type: string
 *                   example: "Limit must be between 1 and 50"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "database_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch videos"
 */
router.get('/', getAllVideos);

/**
 * @swagger
 * /api/videos/{id}:
 *   get:
 *     summary: Lấy chi tiết video + URL streaming HLS
 *     tags: [Videos]
 *     description: |
 *       Lấy thông tin chi tiết video và URL streaming HLS (m3u8) để phát.
 *       
 *       **Tính năng:**
 *       - Auto increment views mỗi lần truy cập
 *       - Trả về URL streaming HLS (Progressive playback)
 *       - Thumbnail 300x200px
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Chi tiết video + URL streaming
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 video:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "68eff234c8db2a37df681570"
 *                     title:
 *                       type: string
 *                     category:
 *                       type: string
 *                     duration:
 *                       type: number
 *                       example: 1800
 *                     estimated_calories:
 *                       type: number
 *                       example: 350
 *                     views:
 *                       type: number
 *                       example: 42
 *                     thumbnail:
 *                       type: string
 *                       format: uri
 *                       description: URL thumbnail 300x200
 *                     streaming_url:
 *                       type: string
 *                       format: uri
 *                       description: URL HLS m3u8 để stream video
 *                       example: "https://res.cloudinary.com/.../pl_hls/video.m3u8"
 *                     url:
 *                       type: string
 *                       format: uri
 *                       description: URL video gốc
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Video không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [video_not_found, invalid_video_id]
 *                   example: "video_not_found"
 *                 message:
 *                   type: string
 *                   example: "Video not found"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "database_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to fetch video details"
 *   delete:
 *     summary: Xóa video (Admin only)
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Xóa video khỏi hệ thống.
 *       
 *       **Tính năng:**
 *       - Xóa từ Cloudinary (dọn dẹp file)
 *       - Xóa record từ MongoDB
 *       - Yêu cầu authentication + Admin role
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Video deleted successfully"
 *       401:
 *         description: Không có authorization hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_token, invalid_token, expired_token]
 *                   example: "missing_token"
 *                 message:
 *                   type: string
 *                   example: "Authorization header required"
 *       404:
 *         description: Video không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [video_not_found, invalid_video_id]
 *                   example: "video_not_found"
 *                 message:
 *                   type: string
 *                   example: "Video not found"
 *       500:
 *         description: Lỗi server hoặc xóa Cloudinary thất bại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [cloudinary_error, database_error, server_error]
 *                   example: "cloudinary_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to delete video from Cloudinary"
 */
router.get('/:id', getVideoById);
router.delete('/:id', authMiddleware, deleteVideoById);

module.exports = router;
