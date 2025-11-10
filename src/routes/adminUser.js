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
 *     summary: Lấy danh sách customer (Admin only)
 *     operationId: adminGetUserList
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Trả về danh sách **customer** (role = customer) dùng cho trang quản trị người dùng.
 *       Endpoint này không trả về tài khoản admin hoặc PT.
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
 *         name: isVerified
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Lọc theo trạng thái xác thực
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
 *                 success: { type: boolean, example: true }
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
 *       400:
 *         description: Tham số lọc/pagination không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: string, example: "invalid_query" }
 *                 message: { type: string, example: "Invalid query parameters" }
 *       401:
 *         description: Token không hợp lệ hoặc thiếu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Unauthorized" }
 *       403:
 *         description: Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Forbidden - Admin access required" }
 *                 yourRole: { type: string, example: "staff" }
 *       404:
 *         description: Không áp dụng cho endpoint này (danh sách rỗng vẫn trả 200)
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "Failed to fetch users" }
 */
router.get('/', authMiddleware, adminMiddleware, getUserList);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Lấy chi tiết một customer (Admin only)
 *     operationId: adminGetUserDetail
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Trả về chi tiết **customer** (role = customer). 
 *       Nếu user không phải customer sẽ trả về lỗi 404.
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
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   $ref: '#/components/schemas/AdminUserInfo'
 *       400:
 *         description: userId không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: string, example: "invalid_id" }
 *                 message: { type: string, example: "Invalid User ID format" }
 *       401:
 *         description: Token không hợp lệ hoặc thiếu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Unauthorized" }
 *       403:
 *         description: Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Forbidden - Admin access required" }
 *                 yourRole: { type: string, example: "customer" }
 *       404:
 *         description: Customer không tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: string, example: "user_not_found" }
 *                 message: { type: string, example: "Customer not found" }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "Failed to fetch user detail" }
 */
router.get('/:userId', authMiddleware, adminMiddleware, getUserDetail);

module.exports = router;
