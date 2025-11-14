// routes/staffProfile.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const authMiddleware = require('../middlewares/authMiddleware');
const staffMiddleware = require('../middlewares/staffMiddleware');
const {
  getProfile,
  updateProfile,
  requestSkillUpdate,
  updateAvatar
} = require('../controllers/staffProfileController');
const { getStaffBookings } = require('../controllers/staffBookingController');

const uploadDir = process.env.UPLOAD_AVATAR_DIR || path.join(os.tmpdir(), 'gymxfit-avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP files are allowed.'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

/**
 * @swagger
 * tags:
 *   name: Staff Profile
 *   description: API cho PT xem và cập nhật hồ sơ của chính mình
 */

/**
 * @swagger
 * /api/staff/profile:
 *   get:
 *     summary: Lấy thông tin hồ sơ PT (self-service)
 *     tags: [Staff Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin hồ sơ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     gender:
 *                       type: string
 *                     dob:
 *                       type: string
 *                       format: date-time
 *                     weight:
 *                       type: number
 *                     height:
 *                       type: number
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                     skillsApprovedByAdmin:
 *                       type: boolean
 *                     skillUpdateRequest:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, approved, rejected]
 *                         requestedAt:
 *                           type: string
 *                           format: date-time
 *                         reviewedAt:
 *                           type: string
 *                           format: date-time
 *                         adminNote:
 *                           type: string
 *                     hireDate:
 *                       type: string
 *                       format: date-time
 *                     isActive:
 *                       type: boolean
 *                     isVerified:
 *                       type: boolean
 *       401:
 *         description: Thiếu hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải tài khoản PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy hồ sơ PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "staff_not_found" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
 */
router.get('/profile', authMiddleware, staffMiddleware, getProfile);

/**
 * @swagger
 * /api/staff/profile:
 *   put:
 *     summary: Cập nhật thông tin hồ sơ cá nhân (không bao gồm skills)
 *     tags: [Staff Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Trấn Thành"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "staff@example.com"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-01"
 *               weight:
 *                 type: number
 *                 example: 70
 *               height:
 *                 type: number
 *                 example: 175
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *       400:
 *         description: Payload không hợp lệ hoặc không có trường nào được cập nhật
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "invalid_field" }
 *                 message: { type: string }
 *       401:
 *         description: Thiếu token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải tài khoản PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy hồ sơ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "staff_not_found" }
 *                 message: { type: string }
 *       409:
 *         description: Email đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "email_taken" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
 */
router.put('/profile', authMiddleware, staffMiddleware, updateProfile);

/**
 * @swagger
 * /api/staff/bookings:
 *   get:
 *     summary: Lịch booking cá nhân của PT
 *     tags: [Staff Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           example: "2025-10-26"
 *         description: Lọc theo ngày (UTC). Nếu có `date`, bỏ qua `from/to`.
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           example: "2025-10-26"
 *         description: Ngày bắt đầu (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           example: "2025-10-30"
 *         description: Ngày kết thúc (YYYY-MM-DD)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, history, cancelled, all]
 *           default: upcoming
 *     responses:
 *       200:
 *         description: Danh sách booking của PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       slotKey: { type: string, example: "14:00-16:00" }
 *                       startTime: { type: string, format: date-time }
 *                       endTime: { type: string, format: date-time }
 *                       status: { type: string, example: "confirmed" }
 *                       notes: { type: string, nullable: true }
 *                       customer:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                           phone: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     pages: { type: integer }
 *       401:
 *         description: Thiếu token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
 */
router.get('/bookings', authMiddleware, staffMiddleware, getStaffBookings);

/**
 * @swagger
 * /api/staff/profile/avatar:
 *   put:
 *     summary: Cập nhật avatar cho PT
 *     tags: [Staff Profile]
 *     security:
 *       - bearerAuth: []
 *     description: Upload ảnh đại diện mới cho PT hiện tại. Hỗ trợ JPEG/PNG/GIF/WEBP, tối đa 5MB.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh (jpg, png, gif, webp)
 *     responses:
 *       200:
 *         description: Cập nhật avatar thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Avatar updated successfully"
 *                 avatar:
 *                   type: string
 *                   example: "https://res.cloudinary.com/.../avatar.jpg"
 *       400:
 *         description: Thiếu file hoặc sai định dạng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "file_missing" }
 *                 message: { type: string }
 *       401:
 *         description: Thiếu token
 *       403:
 *         description: Không phải tài khoản PT
 *       404:
 *         description: Không tìm thấy hồ sơ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "staff_not_found" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/profile/avatar', authMiddleware, staffMiddleware, upload.single('avatar'), updateAvatar);

/**
 * @swagger
 * /api/staff/profile/skills:
 *   put:
 *     summary: Gửi yêu cầu cập nhật kỹ năng (cần admin duyệt)
 *     tags: [Staff Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - skills
 *             properties:
 *               skills:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   enum: [workout, cardio, stretching, nutrition, yoga, other]
 *     responses:
 *       200:
 *         description: Gửi yêu cầu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Skill update request submitted. Please wait for admin approval."
 *                 skillUpdateRequest:
 *                   type: object
 *                   properties:
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     requestedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Dữ liệu kỹ năng không hợp lệ hoặc không thay đổi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "invalid_skills_value" }
 *                 message: { type: string }
 *       401:
 *         description: Thiếu token
 *       403:
 *         description: Không phải PT
 *       404:
 *         description: Không tìm thấy hồ sơ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "staff_not_found" }
 *                 message: { type: string }
 *       409:
 *         description: Đã có yêu cầu pending
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "skill_request_pending" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 */
router.put('/profile/skills', authMiddleware, staffMiddleware, requestSkillUpdate);

module.exports = router;
