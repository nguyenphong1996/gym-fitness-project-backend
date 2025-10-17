// routes/user.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// --- Multer Configuration for Avatar Upload ---
const uploadDir = path.join('/tmp', 'gymxfit-avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP files are allowed.'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});
// ---------------------------------------------

/**
 * @swagger
 * tags:
 *   name: User
 *   description: API quản lý thông tin người dùng (yêu cầu JWT token)
 */

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Lấy thông tin profile của user đang đăng nhập
 *     description: Trả về đầy đủ thông tin profile bao gồm name, email, avatar, dob, weight, height, role
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439011"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     name:
 *                       type: string
 *                       nullable: true
 *                       example: "Nguyen Van A"
 *                     email:
 *                       type: string
 *                       nullable: true
 *                       example: "user@example.com"
 *                     avatar:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                       description: "URL ảnh đại diện"
 *                       example: "https://res.cloudinary.com/.../avatar.jpg"
 *                     gender:
 *                       type: string
 *                       nullable: true
 *                       enum: [male, female, other]
 *                       example: "male"
 *                     dob:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                       example: "1990-01-15"
 *                     weight:
 *                       type: number
 *                       nullable: true
 *                       example: 70
 *                     height:
 *                       type: number
 *                       nullable: true
 *                       example: 175
 *                     role:
 *                       type: string
 *                       enum: [admin, staff, customer]
 *                       example: "customer"
 *                       description: "Vai trò người dùng (mặc định customer)"
 *                     isVerified:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "unauthorized"
 *                 message:
 *                   type: string
 *                   example: "No token provided"
 *       404:
 *         description: User không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "user_not_found"
 *                 message:
 *                   type: string
 *                   example: "User not found"
 */
router.get('/profile', authMiddleware, userController.getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Cập nhật thông tin profile (trừ avatar)
 *     description: |
 *       Cập nhật các trường thông tin profile. **Không dùng để cập nhật avatar.**
 *       Để cập nhật avatar, sử dụng endpoint `PUT /api/user/avatar`.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, maxLength: 20 }
 *               email: { type: string, format: email, maxLength: 30 }
 *               gender: { type: string, enum: [male, female, other] }
 *               dob: { type: string, format: date }
 *               weight: { type: number, minimum: 0, maximum: 300 }
 *               height: { type: number, minimum: 0, maximum: 200 }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 message: { type: string, example: "Profile updated successfully" }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "invalid_email"
 *                 message:
 *                   type: string
 *                   example: "Email format is invalid"
 *       401:
 *         description: Không có quyền truy cập
 */
router.put('/profile', authMiddleware, userController.updateProfile);

/**
 * @swagger
 * /api/user/avatar:
 *   put:
 *     summary: Upload hoặc cập nhật ảnh đại diện
 *     description: |
 *       Upload ảnh đại diện từ thiết bị của người dùng.
 *       - File ảnh sẽ được gửi dưới dạng `multipart/form-data`.
 *       - Nếu đã có avatar cũ, nó sẽ bị xóa khỏi Cloudinary.
 *       - Ảnh sẽ được tự động cắt và tối ưu hóa.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: "File ảnh (JPG, PNG, GIF, WEBP), tối đa 5MB."
 *     responses:
 *       200:
 *         description: Upload avatar thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 message: { type: string, example: "Avatar updated successfully" }
 *                 avatar: { type: string, format: uri, example: "https://res.cloudinary.com/.../new_avatar.jpg" }
 *       400:
 *         description: Lỗi file (không có file, sai định dạng, quá lớn)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "file_missing" }
 *                 message: { type: string, example: "No image file provided." }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string, example: "No token provided" }
 *       404:
 *         description: User không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "user_not_found" }
 *                 message: { type: string, example: "User not found." }
 *       500:
 *         description: Lỗi server hoặc upload thất bại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string, example: "Failed to update avatar." }
 */
router.put('/avatar', authMiddleware, upload.single('avatar'), userController.updateAvatar);


/**
 * @swagger
 * /api/user/account/delete/request:
 *   post:
 *     summary: Yêu cầu xóa tài khoản - Gửi OTP xác nhận
 *     description: |
 *       **⚠️ CẢNH BÁO: TÍNH NĂNG NGUY HIỂM**
 *       
 *       Bước 1 của quy trình xóa tài khoản. API sẽ gửi mã OTP đến số điện thoại để xác nhận.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP đã được gửi thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 message: { type: string, example: "OTP sent to your phone" }
 *                 dev_otp: { type: string, description: "Mã OTP (chỉ có trong sandbox mode)" }
 *                 expiresIn: { type: number, description: "Thời gian hết hạn (giây)" }
 *       401:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string, example: "No token provided" }
 *       429:
 *         description: Vượt quá rate limit hoặc cooldown chưa hết
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [rate_limit_exceeded, cooldown_active]
 *                 message:
 *                   type: string
 */
router.post('/account/delete/request', authMiddleware, userController.requestDeleteAccount);

/**
 * @swagger
 * /api/user/account/delete/confirm:
 *   delete:
 *     summary: Xác nhận xóa tài khoản - PERMANENT DELETE
 *     description: |
 *       **⚠️ CẢNH BÁO: HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC ⚠️**
 *       
 *       Bước 2 của quy trình xóa tài khoản. Xác thực OTP để xóa vĩnh viễn tài khoản.
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "1234", description: "Mã OTP 4 chữ số" }
 *     responses:
 *       200:
 *         description: Tài khoản đã bị xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 message: { type: string, example: "Account deleted successfully" }
 *       400:
 *         description: Validation error hoặc OTP không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_otp, invalid_otp_format, no_otp_request, otp_expired, invalid_otp]
 *                 message:
 *                   type: string
 *       401:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string, example: "No token provided" }
 *       429:
 *         description: Quá số lần thử
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "max_attempts_exceeded"
 *                 message:
 *                   type: string
 */
router.delete('/account/delete/confirm', authMiddleware, userController.confirmDeleteAccount);

module.exports = router;