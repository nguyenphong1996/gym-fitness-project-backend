// routes/user.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

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
 *     description: Trả về đầy đủ thông tin profile bao gồm name, email, avatarUrl, dob, weight, height
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
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                       example: "https://example.com/avatar.jpg"
 *                     dob:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                       example: "1990-01-15"
 *                     weight:
 *                       type: number
 *                       nullable: true
 *                       example: 70
 *                       description: "Weight in kg (0-300)"
 *                     height:
 *                       type: number
 *                       nullable: true
 *                       example: 175
 *                       description: "Height in cm (0-200)"
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
 *                   example: "not_found"
 *                 message:
 *                   type: string
 *                   example: "User not found"
 */
router.get('/profile', authMiddleware, userController.getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Cập nhật thông tin profile
 *     description: |
 *       Cập nhật các trường thông tin profile. Tất cả các trường đều không bắt buộc (optional).
 *       Chỉ gửi các trường muốn cập nhật. Có thể gửi null để xóa giá trị.
 *       
 *       **Validation:**
 *       - name: tối đa 20 ký tự
 *       - email: format email hợp lệ, tối đa 30 ký tự
 *       - avatarUrl: URL hợp lệ
 *       - weight: số dương, 0-300 kg
 *       - height: số dương, 0-200 cm
 *       - dob: format YYYY-MM-DD hoặc dd/mm/yyyy, không được là ngày tương lai
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
 *               name:
 *                 type: string
 *                 maxLength: 20
 *                 example: "Nguyen Van A"
 *                 description: "Họ tên (tối đa 20 ký tự)"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 30
 *                 example: "user@example.com"
 *                 description: "Email (tối đa 30 ký tự)"
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/avatar.jpg"
 *                 description: "URL ảnh đại diện"
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: "1990-01-15"
 *                 description: "Ngày sinh (YYYY-MM-DD hoặc dd/mm/yyyy)"
 *               weight:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 300
 *                 example: 70
 *                 description: "Cân nặng (kg, 0-300)"
 *               height:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 200
 *                 example: 175
 *                 description: "Chiều cao (cm, 0-200)"
 *           examples:
 *             updateAll:
 *               summary: Cập nhật tất cả các trường
 *               value:
 *                 name: "Nguyen Van A"
 *                 email: "user@gmail.com"
 *                 avatarUrl: "https://example.com/avatar.jpg"
 *                 dob: "1990-01-15"
 *                 weight: 70
 *                 height: 175
 *             updatePartial:
 *               summary: Cập nhật một vài trường
 *               value:
 *                 name: "Nguyen Van B"
 *                 weight: 75
 *             clearField:
 *               summary: Xóa một trường
 *               value:
 *                 avatarUrl: null
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
 *                       example: "Nguyen Van A"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                     avatarUrl:
 *                       type: string
 *                       example: "https://example.com/avatar.jpg"
 *                     dob:
 *                       type: string
 *                       format: date
 *                       example: "1990-01-15"
 *                     weight:
 *                       type: number
 *                       example: 70
 *                     height:
 *                       type: number
 *                       example: 175
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
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
 *             examples:
 *               noUpdates:
 *                 summary: Không có trường nào được gửi
 *                 value:
 *                   error: "no_updates"
 *                   message: "No valid fields provided for update"
 *               invalidName:
 *                 summary: Tên vượt quá 20 ký tự
 *                 value:
 *                   error: "invalid_name"
 *                   message: "Name must not exceed 20 characters"
 *               invalidEmail:
 *                 summary: Email không hợp lệ
 *                 value:
 *                   error: "invalid_email"
 *                   message: "Email format is invalid"
 *               invalidWeight:
 *                 summary: Cân nặng không hợp lệ
 *                 value:
 *                   error: "invalid_weight"
 *                   message: "Weight must be a positive number between 0 and 300 kg"
 *               invalidHeight:
 *                 summary: Chiều cao không hợp lệ
 *                 value:
 *                   error: "invalid_height"
 *                   message: "Height must be a positive number between 0 and 200 cm"
 *               invalidDob:
 *                 summary: Ngày sinh không hợp lệ
 *                 value:
 *                   error: "invalid_dob"
 *                   message: "Date of birth cannot be in the future"
 *       401:
 *         description: Không có quyền truy cập
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
 *                   example: "not_found"
 *                 message:
 *                   type: string
 *                   example: "User not found"
 */
router.put('/profile', authMiddleware, userController.updateProfile);

module.exports = router;
