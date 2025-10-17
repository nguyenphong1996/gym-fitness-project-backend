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
 *                 user:
 *                   properties:
 *                     avatar:
 *                       type: string
 *                       format: uri
 *                       nullable: true
 *                       description: "URL ảnh đại diện"
 *                       example: "https://res.cloudinary.com/.../avatar.jpg"
 *       401:
 *         description: Unauthorized
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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               gender: { type: string, enum: [male, female, other] }
 *               dob: { type: string, format: date }
 *               weight: { type: number }
 *               height: { type: number }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Validation error hoặc cố gắng cập nhật avatar
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
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Lỗi server hoặc upload thất bại
 */
router.put('/avatar', authMiddleware, upload.single('avatar'), userController.updateAvatar);


/**
 * @swagger
 * /api/user/account/delete/request:
 *   post:
 *     summary: Yêu cầu xóa tài khoản - Gửi OTP xác nhận
 *     tags: [User]
 *     security: [bearerAuth: []]
 *     responses:
 *       200: { description: "OTP sent" }
 *       401: { description: "Unauthorized" }
 *       429: { description: "Rate limit/cooldown" }
 */
router.post('/account/delete/request', authMiddleware, userController.requestDeleteAccount);

/**
 * @swagger
 * /api/user/account/delete/confirm:
 *   delete:
 *     summary: Xác nhận xóa tài khoản - PERMANENT DELETE
 *     tags: [User]
 *     security: [bearerAuth: []]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: "1234" }
 *     responses:
 *       200: { description: "Account deleted" }
 *       400: { description: "Invalid OTP" }
 *       401: { description: "Unauthorized" }
 *       429: { description: "Max attempts exceeded" }
 */
router.delete('/account/delete/confirm', authMiddleware, userController.confirmDeleteAccount);

module.exports = router;