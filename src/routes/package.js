const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

/**
 * @swagger
 * tags:
 *   name: Membership Packages
 *   description: Quản lý các gói tập (Admin only)
 */

/**
 * @swagger
 * /api/admin/packages:
 *   post:
 *     summary: Tạo gói tập mới
 *     tags: [Membership Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, price, durationDays]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [class_access, pt_session, combo] }
 *               price: { type: number }
 *               durationDays: { type: number }
 *               sessionCount: { type: number }
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/', authMiddleware, adminMiddleware, packageController.createPackage);

/**
 * @swagger
 * /api/admin/packages:
 *   get:
 *     summary: Lấy danh sách gói tập
 *     tags: [Membership Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of packages
 */
router.get('/', authMiddleware, adminMiddleware, packageController.listPackages);

/**
 * @swagger
 * /api/admin/packages/{id}:
 *   put:
 *     summary: Cập nhật thông tin gói tập
 *     tags: [Membership Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id', authMiddleware, adminMiddleware, packageController.updatePackage);

/**
 * @swagger
 * /api/admin/packages/{id}/toggle:
 *   patch:
 *     summary: Bật/tắt trạng thái gói tập
 *     tags: [Membership Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Toggled
 */
router.patch('/:id/toggle', authMiddleware, adminMiddleware, packageController.togglePackageStatus);

module.exports = router;
