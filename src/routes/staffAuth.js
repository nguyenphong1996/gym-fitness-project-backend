// routes/staffAuth.js

const express = require('express');
const router = express.Router();
const { requestOtp, verifyOtp } = require('../controllers/staffAuthController');

/**
 * @swagger
 * tags:
 *   name: Staff Authentication
 *   description: OTP-based authentication flow dành riêng cho PT (Personal Trainer)
 */

/**
 * @swagger
 * /api/staff/auth/request-otp:
 *   post:
 *     summary: Gửi OTP đăng nhập cho PT
 *     tags: [Staff Authentication]
 *     description: |
 *       Cho phép PT yêu cầu mã OTP để hoàn tất xác thực lần đầu hoặc đăng nhập những lần tiếp theo.
 *       
 *       - `purpose=first_login`: Dùng cho PT mới được admin tạo (isVerified=false). Sau khi verify thành công, backend sẽ tự động đặt `isVerified=true`.
 *       - `purpose=login`: Dùng cho các lần đăng nhập tiếp theo (chỉ hợp lệ khi tài khoản đã được verify). Nếu gọi khi chưa verify lần đầu, API trả lỗi `staff_not_verified`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - purpose
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "0912345678"
 *                 description: Số điện thoại của PT
 *               purpose:
 *                 type: string
 *                 enum: [first_login, login]
 *                 example: "first_login"
 *                 description: Xác định mục đích gửi OTP
 *     responses:
 *       200:
 *         description: Gửi OTP thành công
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
 *                   example: "OTP sent successfully to your phone (sandbox mode)"
 *                 sessionId:
 *                   type: string
 *                   example: "sandbox-staff_first_login-1700000000000"
 *                 expiresIn:
 *                   type: number
 *                   example: 600
 *                 dev_otp:
 *                   type: string
 *                   example: "1234"
 *                   description: Chỉ trả về trong sandbox mode
 *                 purpose:
 *                   type: string
 *                   example: "first_login"
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     isVerified:
 *                       type: boolean
 *                       example: false
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc tài khoản đã verify
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "already_verified"
 *                 message:
 *                   type: string
 *       403:
 *         description: Tài khoản chưa verify hoặc đang bị deactivate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [account_deactivated, staff_not_verified]
 *                 message:
 *                   type: string
 *       404:
 *         description: Không tìm thấy tài khoản staff
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "staff_not_found"
 *                 message:
 *                   type: string
 *       429:
 *         description: Rate limit OTP
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
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "server_error"
 *                 message:
 *                   type: string
 */
router.post('/request-otp', requestOtp);

/**
 * @swagger
 * /api/staff/auth/verify-otp:
 *   post:
 *     summary: Xác thực OTP và đăng nhập cho PT
 *     tags: [Staff Authentication]
 *     description: |
 *       Xác thực mã OTP đã gửi cho PT.
 *       - Với `purpose=first_login`: Dùng cho lần đăng nhập đầu tiên sau khi admin tạo tài khoản. OTP hợp lệ sẽ cập nhật `isVerified=true` trước khi sinh token.
 *       - Với `purpose=login`: Dùng cho các lần đăng nhập tiếp theo. Nếu gọi khi chưa hoàn tất `first_login`, API trả về `staff_not_verified`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *               - purpose
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "0912345678"
 *               code:
 *                 type: string
 *                 example: "1234"
 *               purpose:
 *                 type: string
 *                 enum: [first_login, login]
 *                 example: "login"
 *     responses:
 *       200:
 *         description: Xác thực OTP thành công
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
 *                   example: "Staff login successful"
 *                 token:
 *                   type: string
 *                   description: JWT dùng để truy cập các API cần xác thực
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: "staff"
 *                     isVerified:
 *                       type: boolean
 *                       example: true
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     name:
 *                       type: string
 *                       example: "Nguyễn Văn PT"
 *       400:
 *         description: OTP không hợp lệ hoặc tài khoản đã verify
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [invalid_otp_format, missing_otp, already_verified, invalid_purpose]
 *                 message:
 *                   type: string
 *       403:
 *         description: Tài khoản chưa verify (khi purpose=login) hoặc đang bị deactivate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [account_deactivated, staff_not_verified]
 *                 message:
 *                   type: string
 *       404:
 *         description: Không tìm thấy staff
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "staff_not_found"
 *                 message:
 *                   type: string
 *       429:
 *         description: Vượt quá số lần thử OTP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [max_attempts_exceeded, cooldown_active, rate_limit_exceeded]
 *                 message:
 *                   type: string
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "server_error"
 *                 message:
 *                   type: string
 */
router.post('/verify-otp', verifyOtp);

module.exports = router;
