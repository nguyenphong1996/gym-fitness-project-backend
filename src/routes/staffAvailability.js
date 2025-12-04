const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const staffMiddleware = require('../middlewares/staffMiddleware');
const {
  getMyAvailability,
  setMyAvailability
} = require('../controllers/staffAvailabilityController');

/**
 * @swagger
 * tags:
 *   name: Staff Availability
 *   description: Quản lý lịch rảnh của PT
 */

/**
 * @swagger
 * /api/staff/availability:
 *   get:
 *     summary: Xem lịch rảnh của bản thân
 *     tags: [Staff Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Ngày cần xem (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Thông tin lịch rảnh
 */
router.get('/availability', authMiddleware, staffMiddleware, getMyAvailability);

/**
 * @swagger
 * /api/staff/availability:
 *   put:
 *     summary: Cập nhật lịch rảnh (Legacy)
 *     tags: [Staff Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               slots:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.put('/availability', authMiddleware, staffMiddleware, setMyAvailability);

/**
 * @swagger
 * /api/staff/availability/slots:
 *   post:
 *     summary: Đăng ký lịch rảnh (New)
 *     tags: [Staff Availability]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, slots]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2023-10-10"
 *               slots:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["08-10", "10-12"]
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 */
router.post('/availability/slots', authMiddleware, staffMiddleware, setMyAvailability);

module.exports = router;
