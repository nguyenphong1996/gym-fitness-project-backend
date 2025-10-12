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
 *                 description: Số điện thoại (10 số)
 *                 example: "0912345678"
 *     responses:
 *       200:
 *         description: Gửi OTP thành công
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
 *                   example: "OTP đã được gửi đến số điện thoại 0912345678"
 *                 smsId:
 *                   type: string
 *                   example: "abc123xyz"
 *                 dev_otp:
 *                   type: string
 *                   description: Chỉ có trong sandbox mode
 *                   example: "1234"
 *       400:
 *         description: Lỗi validation hoặc số điện thoại đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Quá nhiều yêu cầu OTP
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/verify-register:
 *   post:
 *     summary: Xác thực OTP và tạo tài khoản mới
 *     tags: [Authentication]
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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Đăng ký thành công!"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/verify-register', authController.verifyRegister);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Gửi OTP để đăng nhập
 *     tags: [Authentication]
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
 *                 example: "0912345678"
 *     responses:
 *       200:
 *         description: Gửi OTP thành công
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
 *                   example: "OTP đã được gửi đến số điện thoại 0912345678"
 *                 smsId:
 *                   type: string
 *                   example: "abc123xyz"
 *                 dev_otp:
 *                   type: string
 *                   description: Chỉ có trong sandbox mode
 *                   example: "1234"
 *       400:
 *         description: Số điện thoại không tồn tại hoặc chưa xác thực
 *       429:
 *         description: Quá nhiều yêu cầu OTP
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-login:
 *   post:
 *     summary: Xác thực OTP và đăng nhập
 *     tags: [Authentication]
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
 *                 example: "0912345678"
 *               code:
 *                 type: string
 *                 example: "1234"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
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
 *                   example: "Đăng nhập thành công!"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: OTP không hợp lệ
 */
router.post('/verify-login', authController.verifyLogin);

module.exports = router;