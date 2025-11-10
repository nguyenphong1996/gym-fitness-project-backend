// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: API xác thực người dùng với OTP
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Gửi OTP để đăng ký tài khoản mới
 *     tags: [Authentication]
 *     description: |
 *       Gửi mã OTP đến số điện thoại để xác thực đăng ký.
 *       
 *       **Sandbox Mode:** Khi ESMS_SANDBOX=true, API sẽ trả về dev_otp và chấp nhận bất kỳ mã OTP 4 số nào.
 *       
 *       **Rate Limiting:** Tối đa 50 requests/giờ, cooldown 10 giây giữa các requests.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Số điện thoại Việt Nam (10 số, bắt đầu bằng 0)
 *                 example: "0912345678"
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
 *                   example: "SANDBOX-1760555145795"
 *                 expiresIn:
 *                   type: number
 *                   description: Thời gian hết hạn OTP (giây)
 *                   example: 600
 *                 dev_otp:
 *                   type: string
 *                   description: Mã OTP (chỉ có trong sandbox mode)
 *                   example: "1234"
 *       400:
 *         description: Lỗi validation hoặc số điện thoại đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_phone, invalid_phone, phone_already_registered]
 *                   example: "phone_already_registered"
 *                 message:
 *                   type: string
 *                   example: "Phone number already registered. Please login instead."
 *       429:
 *         description: Quá nhiều yêu cầu OTP hoặc cooldown chưa hết
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [rate_limit_exceeded, cooldown_active]
 *                   example: "cooldown_active"
 *                 message:
 *                   type: string
 *                   example: "Please wait 5s before requesting another OTP."
 *       500:
 *         description: Lỗi server hoặc gửi SMS thất bại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [esms_config_missing, sms_send_failed, server_error]
 *                   example: "sms_send_failed"
 *                 message:
 *                   type: string
 *                   example: "Failed to send OTP. Please try again."
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/verify-register:
 *   post:
 *     summary: Xác thực OTP và tạo tài khoản mới
 *     tags: [Authentication]
 *     description: |
 *       Xác thực mã OTP đã gửi và tạo tài khoản mới.
 *       
 *       **Sandbox Mode:** Chấp nhận bất kỳ mã OTP 4 số nào.
 *       
 *       **Production Mode:** Phải nhập đúng mã OTP được gửi qua SMS. Tối đa 5 lần thử.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Số điện thoại đã đăng ký
 *                 example: "0912345678"
 *               code:
 *                 type: string
 *                 description: Mã OTP 4 số
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Xác thực thành công, trả về token
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
 *                   example: "Registration successful (sandbox mode)"
 *                 token:
 *                   type: string
 *                   description: JWT token để authenticate các requests tiếp theo
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "68eff234c8db2a37df681570"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
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
 *                       example: "2025-10-15T19:12:52.454Z"
 *       400:
 *         description: OTP không hợp lệ, hết hạn hoặc sai
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_phone, invalid_phone, missing_otp, invalid_otp_format, no_otp_request, otp_expired, invalid_otp]
 *                   example: "otp_expired"
 *                 message:
 *                   type: string
 *                   example: "OTP has expired. Please request a new one."
 *       429:
 *         description: Quá số lần thử OTP
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
 *                   example: "Maximum verification attempts exceeded."
 *       500:
 *         description: Lỗi server
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
 *                   example: "Failed to verify OTP. Please try again."
 */
router.post('/verify-register', authController.verifyRegister);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Gửi OTP để đăng nhập
 *     tags: [Authentication]
 *     description: |
 *       Gửi mã OTP đến số điện thoại đã đăng ký để đăng nhập.
 *       
 *       Chỉ áp dụng cho tài khoản đã được xác thực (isVerified=true).
 *       
 *       **Rate Limiting:** Tối đa 50 requests/giờ, cooldown 10 giây.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Số điện thoại đã đăng ký
 *                 example: "0912345678"
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
 *                   example: "OTP sent for login (sandbox mode)"
 *                 smsId:
 *                   type: string
 *                   example: "SANDBOX-LOGIN-1760555599608"
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-10-15T19:18:19.541Z"
 *                 dev_otp:
 *                   type: string
 *                   description: Mã OTP (chỉ có trong sandbox mode)
 *                   example: "2998"
 *       400:
 *         description: Lỗi validation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_phone, invalid_phone]
 *                   example: "invalid_phone"
 *                 message:
 *                   type: string
 *                   example: "Phone number must be 10 digits starting with 0"
 *       404:
 *         description: Số điện thoại không tồn tại hoặc chưa xác thực
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "user_not_found_or_unverified"
 *                 message:
 *                   type: string
 *                   example: "Account not found or not verified. Please sign up first."
 *       429:
 *         description: Quá nhiều yêu cầu hoặc cooldown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [rate_limit_exceeded, cooldown_active]
 *                   example: "cooldown_active"
 *                 message:
 *                   type: string
 *                   example: "Please wait 8s before requesting another OTP."
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [esms_config_missing, sms_send_failed, server_error]
 *                   example: "server_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to send login OTP"
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-login:
 *   post:
 *     summary: Xác thực OTP và đăng nhập
 *     tags: [Authentication]
 *     description: |
 *       Xác thực mã OTP đã gửi và đăng nhập vào hệ thống.
 *       
 *       **Sandbox Mode:** Chấp nhận bất kỳ mã OTP 4 số nào.
 *       
 *       **Production Mode:** Phải nhập đúng mã OTP. Tối đa 5 lần thử.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Số điện thoại đã đăng ký
 *                 example: "0912345678"
 *               code:
 *                 type: string
 *                 description: Mã OTP 4 số
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
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
 *                   example: "Login successful (sandbox mode)"
 *                 token:
 *                   type: string
 *                   description: JWT token để authenticate các requests tiếp theo
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "68eff234c8db2a37df681570"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     role:
 *                       type: string
 *                       enum: [admin, staff, customer]
 *                       example: "customer"
 *                       description: "Vai trò người dùng"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-15T19:12:52.454Z"
 *       400:
 *         description: OTP không hợp lệ, hết hạn hoặc sai
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   enum: [missing_phone, invalid_phone, missing_otp, invalid_otp_format, no_otp_request, otp_expired, invalid_otp]
 *                   example: "invalid_otp"
 *                 message:
 *                   type: string
 *                   example: "Invalid OTP code."
 *       404:
 *         description: User không tồn tại hoặc chưa verify
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
 *                   example: "User not found or not verified"
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
 *                   example: "Maximum verification attempts exceeded."
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "verify_login_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to verify login OTP"
 */
router.post('/verify-login', authController.verifyLogin);

module.exports = router;