const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  staffCheckIn,
  staffCheckOut
} = require('../controllers/classAttendanceController');

/**
 * @swagger
 * tags:
 *   name: Classes (Staff)
 *   description: PT điểm danh nhận lớp bằng QR code
 */

/**
 * @swagger
 * /api/staff/classes/{classId}/check-in:
 *   post:
 *     summary: PT check-in lớp học bằng QR code
 *     operationId: staffCheckIn
 *     tags: [Classes (Staff)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID lớp học
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrValue]
 *             properties:
 *               qrValue:
 *                 type: string
 *                 description: Payload JSON thu được từ QR code
 *                 example: '{"classId":"507f1f77bcf86cd799439013","token":"abc123","type":"class_check","generatedAt":"2025-01-01T08:00:00.000Z"}'
 *     responses:
 *       200:
 *         description: Check-in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Staff check-in recorded successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     attendanceId: { type: string, example: "65f5c0eb2a6d0c1a8f9b4c2e" }
 *                     classId: { type: string, example: "507f1f77bcf86cd799439013" }
 *                     role: { type: string, example: "staff" }
 *                     checkInAt: { type: string, format: "date-time" }
 *                     checkOutAt: { type: string, format: "date-time", nullable: true }
 *       400:
 *         description: QR code không hợp lệ hoặc chưa mở điểm danh
 *       401:
 *         description: Không có token đăng nhập
 *       403:
 *         description: Không phải PT của lớp này
 *       409:
 *         description: PT đã check-in trước đó
 *       404:
 *         description: Không tìm thấy lớp hoặc QR code tương ứng
 *       500:
 *         description: Lỗi hệ thống khi ghi nhận điểm danh
 */
router.post('/:classId/check-in', authMiddleware, staffCheckIn);

/**
 * @swagger
 * /api/staff/classes/{classId}/check-out:
 *   post:
 *     summary: PT check-out lớp học bằng QR code
 *     operationId: staffCheckOut
 *     tags: [Classes (Staff)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID lớp học
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrValue]
 *             properties:
 *               qrValue:
 *                 type: string
 *                 description: Payload JSON thu được từ QR code
 *                 example: '{"classId":"507f1f77bcf86cd799439013","token":"abc123","type":"class_check","generatedAt":"2025-01-01T08:00:00.000Z"}'
 *     responses:
 *       200:
 *         description: Check-out thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Staff check-out recorded successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     attendanceId: { type: string, example: "65f5c0eb2a6d0c1a8f9b4c2e" }
 *                     classId: { type: string, example: "507f1f77bcf86cd799439013" }
 *                     role: { type: string, example: "staff" }
 *                     checkInAt: { type: string, format: "date-time" }
 *                     checkOutAt: { type: string, format: "date-time" }
 *       400:
 *         description: Chưa check-in hoặc QR code không hợp lệ
 *       401:
 *         description: Không có token đăng nhập
 *       403:
 *         description: Không phải PT của lớp này
 *       409:
 *         description: Đã check-out trước đó
 *       404:
 *         description: Không tìm thấy lớp hoặc QR code tương ứng
 *       500:
 *         description: Lỗi hệ thống khi ghi nhận điểm danh
 */
router.post('/:classId/check-out', authMiddleware, staffCheckOut);

module.exports = router;
