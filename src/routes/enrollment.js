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
 *     description: "Customer đăng ký một lớp học"
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: "Enrolled successfully"
 *       400:
 *         description: "Invalid ID"
 *       404:
 *         description: "Not found"
 *       409:
 *         description: "Conflict"
 */
router.post('/classes/:classId/enroll', authMiddleware, enrollmentController.enrollClass);

/**
 * @swagger
 * /api/customer/enrollments:
 *   get:
 *     tags: ["👥 Class Enrollment"]
 *     summary: "📋 Danh sách lớp đã đăng ký"
 *     description: "Lấy danh sách tất cả lớp customer đã đăng ký"
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
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
