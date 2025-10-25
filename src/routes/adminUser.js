// routes/adminUser.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const { getUserList, getUserDetail } = require('../controllers/adminUserController');

/**
 * @swagger
 * tags:
 *   name: Admin - Users
 *   description: Quản trị danh sách user (Admin only)
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lấy danh sách user (Admin only)
 *     operationId: adminGetUserList
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số lượng user mỗi trang
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, staff, customer]
 *         description: Lọc theo role của user
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Lọc theo trạng thái xác thực
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Lọc theo trạng thái kích hoạt (đặc biệt cho staff)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo phone, name hoặc email
 *     responses:
 *       200:
 *         description: Danh sách user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AdminUserInfo'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     pages:
 *                       type: number
 *       401:
 *         description: Token không hợp lệ hoặc thiếu
 *       403:
 *         description: Chỉ admin mới được truy cập
 */
router.get('/', authMiddleware, adminMiddleware, getUserList);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Lấy chi tiết một user (Admin only)
 *     operationId: adminGetUserDetail
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: ID của user (Mongo ObjectId)
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
 *                   $ref: '#/components/schemas/AdminUserInfo'
 *       400:
 *         description: userId không hợp lệ
 *       401:
 *         description: Token không hợp lệ hoặc thiếu
 *       403:
 *         description: Chỉ admin mới được truy cập
 *       404:
 *         description: User không tồn tại
 */
router.get('/:userId', authMiddleware, adminMiddleware, getUserDetail);

module.exports = router;
