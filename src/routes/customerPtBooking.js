// routes/customerPtBooking.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const customerMiddleware = require('../middlewares/customerMiddleware');
const ptBookingController = require('../controllers/ptBookingController');

/**
 * @swagger
 * tags:
 *   name: PT Booking
 *   description: Customer xem lịch trống và đặt lịch PT riêng
 */

/**
 * @swagger
 * /api/customer/pt/availability:
 *   get:
 *     summary: Xem lịch trống của một PT theo ngày
 *     tags: [PT Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         required: true
 *         description: ID của PT
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           example: "2025-10-25"
 *         description: Ngày cần xem (YYYY-MM-DD). Mặc định = hôm nay (UTC).
 *     responses:
 *       200:
 *         description: Danh sách ca 2h từ 08:00-20:00 (nghỉ 12-14h) với trạng thái
 *       400:
 *         description: Thiếu staffId hoặc sai định dạng ngày
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy PT
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/availability', authMiddleware, customerMiddleware, ptBookingController.getAvailability);

/**
 * @swagger
 * /api/customer/pt/bookings:
 *   post:
 *     summary: Đặt lịch PT theo ca 2 giờ
 *     tags: [PT Booking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [staffId, date, slotKey]
 *             properties:
 *               staffId:
 *                 type: string
 *                 example: "68fd104fc6c0083979d6053a"
 *               date:
 *                 type: string
 *                 example: "2025-10-26"
 *                 description: Ngày muốn book (UTC)
 *               slotKey:
 *                 type: string
 *                 enum: ["08:00-10:00","10:00-12:00","14:00-16:00","16:00-18:00","18:00-20:00"]
 *               note:
 *                 type: string
 *                 example: "Muốn tập core & stretching"
 *     responses:
 *       201:
 *         description: Đặt lịch thành công
 *       400:
 *         description: Thiếu dữ liệu hoặc ca đã qua
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy PT
 *       409:
 *         description: Ca đã được book hoặc trùng lớp/booking khác
 *       500:
 *         description: Lỗi hệ thống
 */
router.post('/bookings', authMiddleware, customerMiddleware, ptBookingController.createBooking);

/**
 * @swagger
 * /api/customer/pt/bookings:
 *   get:
 *     summary: Danh sách lịch PT của customer
 *     tags: [PT Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, history, cancelled, all]
 *           default: upcoming
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách booking
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi hệ thống
 */
router.get('/bookings', authMiddleware, customerMiddleware, ptBookingController.getCustomerBookings);

/**
 * @swagger
 * /api/customer/pt/bookings/{bookingId}:
 *   delete:
 *     summary: Huỷ lịch PT (trước giờ bắt đầu)
 *     tags: [PT Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Huỷ thành công
 *       400:
 *         description: Booking đã bắt đầu hoặc không thể huỷ
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy booking
 *       500:
 *         description: Lỗi hệ thống
 */
router.delete('/bookings/:bookingId', authMiddleware, customerMiddleware, ptBookingController.cancelBooking);

module.exports = router;
