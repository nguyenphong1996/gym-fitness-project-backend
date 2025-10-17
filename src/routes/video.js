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
 *                   example: "Video uploaded"
 *                 video:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "68eff234c8db2a37df681570"
 *                     title:
 *                       type: string
 *                       example: "Full Body HIIT Workout"
 *                     duration:
 *                       type: number
 *                       example: 1800
 *                     estimated_calories:
 *                       type: number
 *                       example: 350
 *                     category:
 *                       type: string
 *                       example: "cardio"
 *       400:
 *         description: Validation error - Thiếu field hoặc file không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   enum:
 *                     - "Video file required"
 *                     - "Title, duration, calories required"
 *                     - "Only video files allowed (MP4, MOV, WEBM)"
 *       401:
 *         description: Không có authorization hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Lỗi server hoặc upload Cloudinary thất bại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Upload failed"
 *                 error:
 *                   type: string
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
 *                       id:
 *                         type: string
 *                         example: "68eff234c8db2a37df681570"
 *                       title:
 *                         type: string
 *                         example: "Full Body HIIT"
 *                       thumbnail:
 *                         type: string
 *                         format: uri
 *                         description: URL thumbnail 300x200
 *                       duration:
 *                         type: number
 *                         example: 1800
 *                       estimated_calories:
 *                         type: number
 *                         example: 350
 *                       category:
 *                         type: string
 *                         example: "cardio"
 *                       views:
 *                         type: number
 *                         example: 42
 *                 total:
 *                   type: number
 *                   example: 45
 *                   description: Tổng số video
 *                 page:
 *                   type: number
 *                   example: 1
 *                 pages:
 *                   type: number
 *                   example: 5
 *                   description: Tổng số trang
 *       400:
 *         description: Validation error (page, limit không hợp lệ)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid page or limit"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Get videos failed"
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
 *                     id:
 *                       type: string
 *                       example: "68eff234c8db2a37df681570"
 *                     title:
 *                       type: string
 *                       example: "Full Body HIIT"
 *                     thumbnail:
 *                       type: string
 *                       format: uri
 *                       description: URL thumbnail 300x200
 *                     streaming_url:
 *                       type: string
 *                       format: uri
 *                       description: URL HLS m3u8 để stream video
 *                     duration:
 *                       type: number
 *                       example: 1800
 *                     estimated_calories:
 *                       type: number
 *                       example: 350
 *                     category:
 *                       type: string
 *                       example: "cardio"
 *                     views:
 *                       type: number
 *                       example: 43
 *       404:
 *         description: Video không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
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
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Get video failed"
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
 *                   example: "Video deleted"
 *       401:
 *         description: Không có authorization hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       404:
 *         description: Video không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
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
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Delete failed"
 */
router.get('/:id', getVideoById);
router.delete('/:id', authMiddleware, deleteVideoById);

module.exports = router;
