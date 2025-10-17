const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
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
 *     summary: Upload video workout mới (Admin only)
 *     operationId: uploadVideo
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Upload video workout lên Cloudinary với HLS streaming.
 *       
 *       ✅ **Yêu cầu:**
 *       - Authorization: Bearer token (Admin role)
 *       - Multipart form data với file video
 *       - Title và estimated_calories bắt buộc
 *       
 *       🎬 **Tính năng tự động:**
 *       - Duration được trích xuất tự động từ metadata video bởi Cloudinary
 *       - Thumbnail 300x200px từ frame đầu
 *       - HLS m3u8 streaming URL được tạo sẵn
 *       
 *       📋 **Định dạng hỗ trợ:**
 *       - MP4, MOV, WEBM
 *       - Max: 100MB
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - video
 *               - title
 *               - estimated_calories
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (MP4, MOV, WEBM), max 100MB
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 example: "Full Body HIIT Workout"
 *                 description: Tên video (bắt buộc)
 *               estimated_calories:
 *                 type: number
 *                 minimum: 0
 *                 example: 350
 *                 description: Ước tính calories đốt cháy (bắt buộc)
 *               category:
 *                 type: string
 *                 enum: ["workout", "nutrition", "stretching", "cardio", "yoga", "other"]
 *                 example: "cardio"
 *                 description: Loại video (mặc định "workout" nếu không ghi)
 *     responses:
 *       201:
 *         description: Upload thành công - Video sẵn sàng phát stream
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
 *                       format: uuid
 *                       example: "68eff234c8db2a37df681570"
 *                       description: MongoDB ObjectId
 *                     title:
 *                       type: string
 *                       example: "Full Body HIIT Workout"
 *                     duration:
 *                       type: number
 *                       example: 1800
 *                       description: Thời lượng video (giây) - từ Cloudinary
 *                     estimated_calories:
 *                       type: number
 *                       example: 350
 *                     category:
 *                       type: string
 *                       example: "cardio"
 *       400:
 *         description: Bad Request - Dữ liệu không hợp lệ
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
 *                   example: "Title and estimated calories required"
 *                   description: "Lỗi có thể là: Video file required | Title and estimated calories required | Only video files allowed (MP4, MOV, WEBM)"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới được upload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *                 yourRole:
 *                   type: string
 *                   example: "customer"
 *       413:
 *         description: Payload Too Large - File vượt quá 100MB
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "File too large"
 *       500:
 *         description: Internal Server Error - Lỗi upload Cloudinary
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
 *                   example: "Cloudinary error message"
 */
router.post('/upload', adminMiddleware, upload.single('video'), uploadVideoFile);

/**
 * @swagger
 * /api/videos:
 *   get:
 *     summary: Danh sách video workout (Pagination, Filter, Search)
 *     operationId: getAllVideos
 *     tags: [Videos]
 *     description: |
 *       Lấy danh sách tất cả video workout với các tính năng:
 *       
 *       📖 **Pagination:** Chia trang, điều chỉnh số lượng
 *       🏷️ **Filter:** Lọc theo loại video (category)
 *       🔍 **Search:** Tìm kiếm theo tên video
 *       📅 **Sorting:** Sắp xếp theo mới nhất trước
 *       
 *       **Response:** Trả về danh sách video với thumbnail, không cần auth
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Số video mỗi trang (1-50)
 *         example: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: ["workout", "nutrition", "stretching", "cardio", "yoga", "other"]
 *         description: Lọc theo loại video
 *         example: "cardio"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo title video
 *         example: "HIIT"
 *     responses:
 *       200:
 *         description: Danh sách videos thành công
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
 *                         format: uuid
 *                         example: "68eff234c8db2a37df681570"
 *                       title:
 *                         type: string
 *                         example: "Full Body HIIT"
 *                       thumbnail:
 *                         type: string
 *                         format: uri
 *                         description: URL thumbnail 300x200px
 *                         example: "https://res.cloudinary.com/.../c_thumb,h_200,w_300/video.jpg"
 *                       duration:
 *                         type: number
 *                         description: Thời lượng video (giây)
 *                         example: 1800
 *                       estimated_calories:
 *                         type: number
 *                         description: Ước tính kcal đốt cháy
 *                         example: 350
 *                       category:
 *                         type: string
 *                         example: "cardio"
 *                       views:
 *                         type: number
 *                         description: Số lượt xem
 *                         example: 42
 *                 total:
 *                   type: number
 *                   description: Tổng số video (sau filter)
 *                   example: 45
 *                 page:
 *                   type: number
 *                   description: Trang hiện tại
 *                   example: 1
 *                 pages:
 *                   type: number
 *                   description: Tổng số trang
 *                   example: 5
 *       500:
 *         description: Internal Server Error
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
 *     operationId: getVideoById
 *     tags: [Videos]
 *     description: |
 *       Lấy thông tin chi tiết video, URL streaming HLS (m3u8) để phát stream.
 *       
 *       ✨ **Tính năng tự động:**
 *       - 👁️ Auto increment views mỗi lần truy cập
 *       - 🎬 Trả về URL streaming HLS (m3u8) cho phát progressive
 *       - 🖼️ Thumbnail 300x200px
 *       
 *       **Authentication:** Không cần token
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Video ID (MongoDB ObjectId)
 *         example: "68eff234c8db2a37df681570"
 *     responses:
 *       200:
 *         description: Chi tiết video + URL streaming thành công
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
 *                       format: uuid
 *                       example: "68eff234c8db2a37df681570"
 *                     title:
 *                       type: string
 *                       example: "Full Body HIIT"
 *                     thumbnail:
 *                       type: string
 *                       format: uri
 *                       description: URL thumbnail 300x200px
 *                       example: "https://res.cloudinary.com/.../c_thumb,h_200,w_300/video.jpg"
 *                     streaming_url:
 *                       type: string
 *                       format: uri
 *                       description: URL HLS m3u8 để stream video (progressive playback)
 *                       example: "https://res.cloudinary.com/.../master.m3u8"
 *                     duration:
 *                       type: number
 *                       description: Thời lượng video (giây)
 *                       example: 1800
 *                     estimated_calories:
 *                       type: number
 *                       description: Ước tính kcal đốt cháy
 *                       example: 350
 *                     category:
 *                       type: string
 *                       example: "cardio"
 *                     views:
 *                       type: number
 *                       description: Số lượt xem (auto increment)
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
 *         description: Internal Server Error
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
 *     operationId: deleteVideoById
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Xóa video khỏi hệ thống.
 *       
 *       ⚠️ **Yêu cầu:** 
 *       - Authorization: Bearer token (Admin role)
 *       - Chỉ admin mới có quyền xóa
 *       
 *       🗑️ **Tính năng tự động:**
 *       - Xóa file từ Cloudinary (dọn dẹp dung lượng)
 *       - Xóa record từ MongoDB
 *       - Không thể hoàn tác
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Video ID (MongoDB ObjectId)
 *         example: "68eff234c8db2a37df681570"
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
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới được xóa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *                 yourRole:
 *                   type: string
 *                   example: "customer"
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
 *         description: Internal Server Error - Lỗi server hoặc xóa Cloudinary thất bại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
                 message:
                   type: string
                   example: "Delete failed"
 */
router.get('/:id', getVideoById);
router.delete('/:id', adminMiddleware, deleteVideoById);

module.exports = router;
