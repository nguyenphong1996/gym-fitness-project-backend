// routes/enrollment.js
const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

/**
 * @swagger
 * tags:
 *   - name: "👥 Class Enrollment"
 *     description: "Customer enrollment management"
 */

// Customer endpoints
/**
 * @swagger
 * /api/customer/classes/{classId}/enroll:
 *   post:
 *     tags: ["👥 Class Enrollment"]
 *     summary: "📝 Đăng ký lớp học"
 *     operationId: enrollClass
 *     description: |
 *       Customer đăng ký một lớp học.
 *
 *       ✅ **Yêu cầu:**
 *       - Authorization: Bearer token (Customer role)
 *       - Class ID phải tồn tại và còn mở đăng ký
 *
 *       🔑 **Logic:**
 *       - Kiểm tra class tồn tại và còn mở
 *       - Kiểm tra customer chưa đăng ký class này
 *       - Tạo enrollment với status = 'active'
 *       - Cập nhật currentEnrollment trong class
 *
 *       ⏰ **Time:** Class phải bắt đầu trong tương lai
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Class ID (MongoDB ObjectId)
 *         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *     responses:
 *       201:
 *         description: Đăng ký lớp học thành công
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
 *                   example: "Enrolled in class successfully"
 *                 enrollment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     customerId:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2f"
 *                     classId:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     status:
 *                       type: string
 *                       example: "active"
 *                       enum: ["active", "completed", "cancelled"]
 *                     enrolledAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-23T10:30:00Z"
 *       400:
 *         description: Bad Request - Lỗi validation hoặc class không thể đăng ký
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Class is full"
 *       404:
 *         description: Not Found - Không tìm thấy lớp học
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Class not found"
 *       409:
 *         description: Conflict - Customer đã đăng ký lớp này rồi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Already enrolled in this class"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ customer mới được đăng ký lớp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Customer access required"
 *       500:
 *         description: Server Error - Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to enroll in class"
 *                 error:
 *                   type: string
 */
router.post('/classes/:classId/enroll', authMiddleware, enrollmentController.enrollClass);

/**
 * @swagger
 * /api/customer/enrollments:
 *   get:
 *     tags: ["👥 Class Enrollment"]
 *     summary: "📋 Danh sách lớp đã đăng ký"
 *     operationId: getMyEnrollments
 *     description: |
 *       Lấy danh sách tất cả lớp customer đã đăng ký.
 *
 *       📖 **Pagination:** page, limit
 *       🏷️ **Filter:** status (active, completed, cancelled)
 *       📅 **Sorting:** Mới nhất trước
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter theo trạng thái enrollment
 *         example: "active"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số enrollment mỗi trang
 *         example: 10
 *     responses:
 *       200:
 *         description: Lấy danh sách enrollment thành công
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                       classId:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           category:
 *                             type: string
 *                           startTime:
 *                             type: string
 *                             format: date-time
 *                           endTime:
 *                             type: string
 *                             format: date-time
 *                       status:
 *                         type: string
 *                         example: "active"
 *                         enum: ["active", "completed", "cancelled"]
 *                       enrolledAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-23T10:30:00Z"
 *                       cancellationReason:
 *                         type: string
 *                         example: null
 *                       cancelledAt:
 *                         type: string
 *                         format: date-time
 *                         example: null
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 25
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     pages:
 *                       type: number
 *                       example: 3
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ customer mới được xem enrollments của mình
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Customer access required"
 *       500:
 *         description: Server Error - Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Failed to get enrollments"
 *                 error:
 *                   type: string
 */
router.get('/enrollments', authMiddleware, enrollmentController.getMyEnrollments);

/**
 * @swagger
 * /api/customer/enrollments/{enrollmentId}:
 *   get:
 *     tags: ["👥 Class Enrollment"]
 *     summary: "🔍 Chi tiết enrollment"
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Success"
 */
router.get('/enrollments/:enrollmentId', authMiddleware, enrollmentController.getEnrollmentDetail);

/**
 * @swagger
 * /api/customer/enrollments/{enrollmentId}/cancel:
 *   patch:
 *     tags: ["👥 Class Enrollment"]
 *     summary: "❌ Hủy đăng ký lớp"
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancellationReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: "Cancelled successfully"
 */
router.patch('/enrollments/:enrollmentId/cancel', authMiddleware, enrollmentController.cancelEnrollment);

// Admin endpoint
/**
 * @swagger
 * /api/admin/classes/{classId}/enrollments:
 *   get:
 *     tags: ["👥 Class Enrollment"]
 *     summary: "👨‍💼 Danh sách enrollments của lớp (Admin)"
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: "Success"
 */
router.get('/classes/:classId/enrollments', authMiddleware, adminMiddleware, enrollmentController.getClassEnrollments);

module.exports = router;
