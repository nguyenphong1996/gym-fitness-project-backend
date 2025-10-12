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
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Không có token hoặc token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', authMiddleware, userController.getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Cập nhật thông tin profile
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
 *                 example: "Nguyen Van A"
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
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
 *                   example: "Cập nhật profile thành công"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Không có quyền truy cập
 */
router.put('/profile', authMiddleware, userController.updateProfile);

module.exports = router;
