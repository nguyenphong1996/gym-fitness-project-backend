const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { staffAttendanceScan } = require('../controllers/classAttendanceController');

/**
 * @swagger
 * tags:
 *   name: Classes (Staff)
 *   description: PT điểm danh nhận lớp bằng QR code
 */

/**
 * @swagger
 * /api/staff/classes/{classId}/attendance/scan:
 *   post:
 *     summary: PT quét QR để tự động check-in/check-out giống customer
 *     operationId: staffAttendanceScan
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
 *         description: Tự động ghi nhận check-in (lần đầu) hoặc cập nhật check-out (các lần sau)
 *       400:
 *         description: QR không hợp lệ hoặc chưa đến cửa sổ điểm danh
 *       401:
 *         description: Thiếu token đăng nhập
 *       403:
 *         description: Không phải PT được gán lớp
 *       404:
 *         description: Không tìm thấy lớp hoặc QR tương ứng
 *       409:
 *         description: Lớp đã kết thúc ngoài thời gian cho phép
 *       500:
 *         description: Lỗi hệ thống khi ghi nhận điểm danh
 */
router.post('/:classId/attendance/scan', authMiddleware, staffAttendanceScan);

module.exports = router;
