const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  getAllFacilities,
  createFacility,
  getCheckinHistory
} = require('../controllers/facilityController');

/**
 * @swagger
 * tags:
 *   name: Admin Facility
 *   description: Quản lý khu vực và lịch sử ra vào (Admin)
 */

/**
 * @swagger
 * /api/admin/facilities:
 *   get:
 *     summary: Lấy danh sách tất cả khu vực
 *     tags: [Admin Facility]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách khu vực
 */
router.get('/', authMiddleware, adminMiddleware, getAllFacilities);

/**
 * @swagger
 * /api/admin/facilities:
 *   post:
 *     summary: Tạo khu vực mới
 *     tags: [Admin Facility]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [facilityCode, name]
 *             properties:
 *               facilityCode: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               qrCodeData: { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post('/', authMiddleware, adminMiddleware, createFacility);

/**
 * @swagger
 * /api/admin/facilities/checkins:
 *   get:
 *     summary: Xem lịch sử check-in
 *     tags: [Admin Facility]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: facilityCode
 *         schema: { type: string }
 *       - in: query
 *         name: userId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lịch sử check-in
 */
router.get('/checkins', authMiddleware, adminMiddleware, getCheckinHistory);

module.exports = router;
