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
 *         description: Danh sách ca 2h (08-10 · 10-12 · 14-16 · 16-18 · 18-20) kèm trạng thái
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     phone: { type: string }
 *                 date:
 *                   type: string
 *                   format: date-time
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                         example: "08:00-10:00"
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                       endTime:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         enum: [available, booked, booked_by_you, blocked]
 *                       bookingId:
 *                         type: string
 *                         nullable: true
 *                       conflict:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: "class"
 *                           classId:
 *                             type: string
 *                           className:
 *                             type: string
 *       400:
 *         description: Thiếu staffId hoặc sai định dạng ngày
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "invalid_date" }
 *                 message: { type: string }
 *       401:
 *         description: Chưa đăng nhập / token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải customer (do dùng middleware customer)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy PT hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "staff_not_found" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "PT booked successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     staffId: { type: string }
 *                     customerId: { type: string }
 *                     slotKey: { type: string, example: "14:00-16:00" }
 *                     startTime: { type: string, format: date-time }
 *                     endTime: { type: string, format: date-time }
 *                     status: { type: string, example: "confirmed" }
 *       400:
 *         description: Thiếu dữ liệu, slot key sai, hoặc ca đã ở quá khứ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "invalid_slot" }
 *                 message: { type: string }
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải customer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy PT hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "staff_not_found" }
 *                 message: { type: string }
 *       409:
 *         description: Ca đã được book hoặc trùng với lịch của khách
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "slot_taken" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       slotKey: { type: string }
 *                       startTime: { type: string, format: date-time }
 *                       endTime: { type: string, format: date-time }
 *                       status: { type: string, example: "confirmed" }
 *                       staff:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                           phone: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     pages: { type: integer }
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải customer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string, example: "Booking cancelled successfully" }
 *       400:
 *         description: Booking đã bắt đầu hoặc không thể huỷ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "already_started" }
 *                 message: { type: string }
 *       401:
 *         description: Chưa đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Không phải owner của booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "forbidden" }
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "booking_not_found" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
 */
router.delete('/bookings/:bookingId', authMiddleware, customerMiddleware, ptBookingController.cancelBooking);

module.exports = router;
