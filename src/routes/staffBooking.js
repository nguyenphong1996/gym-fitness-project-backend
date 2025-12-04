const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const staffMiddleware = require('../middlewares/staffMiddleware');
const {
  getStaffBookings,
  acceptStaffBooking,
  cancelStaffBooking
} = require('../controllers/staffBookingController');

/**
 * @swagger
 * tags:
 *   name: Staff Booking
 *   description: Quản lý lịch đặt PT (Dành cho PT)
 */

/**
 * @swagger
 * /api/staff/bookings:
 *   get:
 *     summary: Xem danh sách booking của PT
 *     tags: [Staff Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Lọc theo ngày (YYYY-MM-DD)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, history, cancelled, all]
 *           default: upcoming
 *         description: Trạng thái booking
 *     responses:
 *       200:
 *         description: Danh sách booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/', authMiddleware, staffMiddleware, getStaffBookings);

/**
 * @swagger
 * /api/staff/bookings/{id}/confirm:
 *   patch:
 *     summary: PT xác nhận booking
 *     tags: [Staff Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking confirmed
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Booking not found
 */
router.patch('/:bookingId/confirm', authMiddleware, staffMiddleware, acceptStaffBooking);

/**
 * @swagger
 * /api/staff/bookings/{id}/cancel:
 *   patch:
 *     summary: PT hủy booking
 *     tags: [Staff Booking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking cancelled
 *       400:
 *         description: Invalid status or missing reason
 *       404:
 *         description: Booking not found
 */
router.patch('/:bookingId/cancel', authMiddleware, staffMiddleware, cancelStaffBooking);

module.exports = router;
