const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  createClass,
  getClassList,
  getClassDetail,
  updateClass,
  openClass,
  closeClass,
  deleteClass,
  getClassQRCode
} = require('../controllers/classController');

/**
 * @swagger
 * tags:
 *   name: Classes
 *   description: Quản lý lớp học, lịch học, PT và check-in
 */

/**
 * @swagger
 * /api/admin/classes/create:
 *   post:
 *     summary: Tạo lớp học mới (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, capacity, startTime, endTime, staffId]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên lớp học (2-100 ký tự)
 *                 example: "Upper Body Workout"
 *               category:
 *                 type: string
 *                 enum: [workout, cardio, stretching, nutrition, yoga, other]
 *                 description: Danh mục lớp học
 *                 example: "workout"
 *               subcategory:
 *                 type: string
 *                 description: Danh mục con (nếu có)
 *                 example: "Upper Body"
 *               capacity:
 *                 type: integer
 *                 description: Sức chứa lớp học (1-100 học viên)
 *                 example: 20
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Thời gian bắt đầu (ISO 8601)
 *                 example: "2025-10-25T09:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Thời gian kết thúc (ISO 8601)
 *                 example: "2025-10-25T10:00:00Z"
 *               staffId:
 *                 type: string
 *                 pattern: '^[0-9a-f]{24}$'
 *                 description: ID của PT giảng dạy (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               description:
 *                 type: string
 *                 description: Mô tả lớp học (max 500 ký tự)
 *                 example: "Tập luyện toàn bộ cơ thể trên"
 *               location:
 *                 type: string
 *                 description: Địa điểm tập luyện (2-100 ký tự)
 *                 example: "Phòng A - Tầng 2"
 *     responses:
 *       201:
 *         description: Lớp học được tạo thành công
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
 *                   example: "Class created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *                     capacity:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [draft, scheduled, ongoing, completed, cancelled]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc PT không hợp lệ
 *       401:
 *         description: Không có quyền truy cập (chưa đăng nhập)
 *       403:
 *         description: Không phải admin
 *       500:
 *         description: Lỗi server
 */
router.post('/create', authMiddleware, adminMiddleware, createClass);

/**
 * @swagger
 * /api/admin/classes:
 *   get:
 *     summary: Lấy danh sách lớp học với phân trang và lọc (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lớp học trên mỗi trang (max 50)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, ongoing, completed, cancelled]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [workout, cardio, stretching, nutrition, yoga, other]
 *         description: Lọc theo danh mục
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Lọc theo PT giảng dạy
 *     responses:
 *       200:
 *         description: Danh sách lớp học được lấy thành công
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       capacity:
 *                         type: integer
 *                       currentEnrollment:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       staffId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           name:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Không phải admin
 *       500:
 *         description: Lỗi server
 */
router.get('/', authMiddleware, adminMiddleware, getClassList);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   get:
 *     summary: Lấy chi tiết một lớp học (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học
 *     responses:
 *       200:
 *         description: Chi tiết lớp học
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     category:
 *                       type: string
 *                     subcategory:
 *                       type: string
 *                     description:
 *                       type: string
 *                     capacity:
 *                       type: integer
 *                     currentEnrollment:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     location:
 *                       type: string
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                     staffId:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *       404:
 *         description: Lớp học không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get('/:classId', authMiddleware, adminMiddleware, getClassDetail);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   patch:
 *     summary: Cập nhật thông tin lớp học (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Các trường cần cập nhật (tất cả đều optional)
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [workout, cardio, stretching, nutrition, yoga, other]
 *               subcategory:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Lớp học không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch('/:classId', authMiddleware, adminMiddleware, updateClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/open:
 *   patch:
 *     summary: Mở lớp học để nhận đăng ký (chuyển từ draft sang scheduled) (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học
 *     responses:
 *       200:
 *         description: Mở lớp học thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: Lớp học không ở trạng thái draft
 *       404:
 *         description: Lớp học không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch('/:classId/open', authMiddleware, adminMiddleware, openClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/close:
 *   patch:
 *     summary: Đóng lớp học (completed hoặc cancelled) (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [completed, cancelled]
 *                 description: Lý do đóng lớp học
 *                 example: "completed"
 *     responses:
 *       200:
 *         description: Đóng lớp học thành công
 *       400:
 *         description: Lớp học đã ở trạng thái completed/cancelled
 *       404:
 *         description: Lớp học không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.patch('/:classId/close', authMiddleware, adminMiddleware, closeClass);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   delete:
 *     summary: Xóa lớp học (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học
 *     responses:
 *       200:
 *         description: Xóa lớp học thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Lớp học không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.delete('/:classId', authMiddleware, adminMiddleware, deleteClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/qrcode:
 *   get:
 *     summary: Lấy QR code của lớp học để check-in (Admin only)
 *     tags: [Classes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học
 *     responses:
 *       200:
 *         description: QR code lấy thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     classId:
 *                       type: string
 *                     className:
 *                       type: string
 *                     qrCode:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                         cloudinary_id:
 *                           type: string
 *       400:
 *         description: Lớp học chưa có QR code
 *       404:
 *         description: Lớp học không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get('/:classId/qrcode', authMiddleware, adminMiddleware, getClassQRCode);

module.exports = router;
