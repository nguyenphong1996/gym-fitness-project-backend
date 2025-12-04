const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { checkInFacility, getMyAccess } = require('../controllers/facilityController');

/**
 * @swagger
 * tags:
 *   name: Facility Access
 *   description: Quản lý ra vào các khu vực (Gym, Pool, Sauna...)
 */

/**
 * @swagger
 * /api/customer/facility/checkin:
 *   post:
 *     summary: Check-in vào khu vực bằng QR Code
 *     tags: [Facility Access]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scanData]
 *             properties:
 *               scanData:
 *                 type: string
 *                 description: Dữ liệu quét được từ mã QR tại khu vực
 *                 example: "gym_floor_qr_01"
 *     responses:
 *       200:
 *         description: Check-in thành công
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
 *                   example: "Check-in thành công! Chúc bạn có trải nghiệm tốt tại Phòng Tập Chính."
 *       403:
 *         description: Từ chối truy cập (Gói không hỗ trợ hoặc hết hạn)
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
 *                   example: "Gói Basic của bạn không bao gồm quyền truy cập Hồ Bơi."
 *       404:
 *         description: Mã QR không hợp lệ
 */
router.post('/checkin', authMiddleware, checkInFacility);

/**
 * @swagger
 * /api/customer/facility/access:
 *   get:
 *     summary: Xem quyền truy cập các khu vực của gói hiện tại
 *     tags: [Facility Access]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 access:
 *                   type: object
 *                   properties:
 *                     gymFloor: { type: boolean }
 *                     swimmingPool: { type: boolean }
 *                     sauna: { type: boolean }
 *                     spa: { type: boolean }
 *                 packageName: { type: string }
 *                 status: { type: string }
 */
router.get('/access', authMiddleware, getMyAccess);

module.exports = router;
