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
  generateClassQRCode,
  getClassQRCode
} = require('../controllers/classController');

/**
 * @swagger
 * tags:
 *   name: Classes (Admin)
 *   description: Quản lý lớp học, lịch học, PT giảng dạy (Admin only)
 */

/**
 * @swagger
 * /api/admin/classes/create:
 *   post:
 *     summary: Tạo lớp học mới (Admin only)
 *     operationId: createClass
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin tạo lớp học mới.
 *
 *       ✅ **Yêu cầu bắt buộc:**
 *       - name: Tên lớp (2-100 ký tự)
 *       - category: Danh mục (workout, cardio, stretching, nutrition, yoga, other)
 *       - capacity: Sức chứa (1-100 học viên)
 *       - startTime: Thời gian bắt đầu (ISO 8601, phải trong tương lai)
 *       - endTime: Thời gian kết thúc (phải > startTime, duration ≥ 15 phút)
 *       - staffId: ID PT giảng dạy (PT phải active + skills approved)
 *
 *       📝 **Yêu cầu tuỳ chọn:**
 *       - subcategory: Danh mục con
 *       - description: Mô tả lớp (max 500 ký tự)
 *       - location: Địa điểm (2-100 ký tự)
 *
 *       🔑 **Quy trình tạo lớp:**
 *       1. Admin POST với thông tin lớp + staffId
 *       2. Hệ thống kiểm tra PT: tồn tại, role=staff, isActive=true, skillsApprovedByAdmin=true
 *       3. Lớp tạo với status='draft' (chưa mở)
 *       4. Admin gọi /open để mở lớp → status='scheduled'
 *       5. Học viên có thể đăng ký
 *
 *       ⚠️ **Lưu ý:**
 *       - Nếu PT không active hoặc chưa approve skills → 400 error
 *       - startTime phải tương lai
 *       - duration < 15 phút → error
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
 *                 minLength: 2
 *                 maxLength: 100
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
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Sức chứa lớp học (1-100 học viên)
 *                 example: 20
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Thời gian bắt đầu (ISO 8601, phải trong tương lai)
 *                 example: "2025-10-25T09:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Thời gian kết thúc (ISO 8601, phải > startTime)
 *                 example: "2025-10-25T10:00:00Z"
 *               staffId:
 *                 type: string
 *                 pattern: '^[0-9a-f]{24}$'
 *                 description: ID của PT giảng dạy (ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Mô tả lớp học (max 500 ký tự)
 *                 example: "Tập luyện toàn bộ cơ thể trên"
 *               location:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
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
 *                 class:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "Upper Body Workout"
 *                     category:
 *                       type: string
 *                       example: "workout"
 *                     subcategory:
 *                       type: string
 *                       example: "Upper Body"
 *                     capacity:
 *                       type: integer
 *                       example: 20
 *                     currentEnrollment:
 *                       type: integer
 *                       example: 0
 *                     status:
 *                       type: string
 *                       example: "draft"
 *                       enum: ["draft", "scheduled", "ongoing", "completed", "cancelled"]
 *                     description:
 *                       type: string
 *                       example: "Tập luyện toàn bộ cơ thể trên"
 *                     location:
 *                       type: string
 *                       example: "Phòng A - Tầng 2"
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-25T09:00:00Z"
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-25T10:00:00Z"
 *                     staffId:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "PT Nguyễn Văn A"
 *                         phone:
 *                           type: string
 *                           example: "0912345678"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-23T10:30:00Z"
 *       400:
 *         description: Bad Request - Validation Error hoặc PT không hợp lệ
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
 *                   example: "Validation error"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       error:
 *                         type: string
 *                       message:
 *                         type: string
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới được tạo lớp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - PT không tồn tại
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
 *                   example: "PT not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to create class"
 *                 error:
 *                   type: string
 */
router.post('/create', authMiddleware, adminMiddleware, createClass);

/**
 * @swagger
 * /api/admin/classes:
 *   get:
 *     summary: Lấy danh sách lớp học (Admin only)
 *     operationId: getClassList
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Lấy danh sách tất cả lớp học với phân trang và filter.
 *
 *       📊 **Hỗ trợ:**
 *       - Phân trang: page, limit
 *       - Lọc: status (draft, scheduled, ongoing, completed, cancelled), category, staffId
 *       - Sắp xếp: Mới nhất trước (createdAt desc)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Số lớp học trên mỗi trang (max 50)
 *         example: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, ongoing, completed, cancelled]
 *         description: Lọc theo trạng thái
 *         example: "scheduled"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [workout, cardio, stretching, nutrition, yoga, other]
 *         description: Lọc theo danh mục
 *         example: "yoga"
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Lọc theo PT giảng dạy
 *         example: "507f1f77bcf86cd799439011"
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439013"
 *                       name:
 *                         type: string
 *                         example: "Yoga Buổi Sáng"
 *                       category:
 *                         type: string
 *                         example: "yoga"
 *                       capacity:
 *                         type: integer
 *                         example: 15
 *                       currentEnrollment:
 *                         type: integer
 *                         example: 8
 *                       status:
 *                         type: string
 *                         example: "scheduled"
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-25T07:00:00Z"
 *                       endTime:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-25T08:00:00Z"
 *                       staffId:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           phone:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-23T10:30:00Z"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     pages:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới được xem danh sách
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to get class list"
 *                 error:
 *                   type: string
 */
router.get('/', authMiddleware, adminMiddleware, getClassList);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   get:
 *     summary: Xem chi tiết lớp học (Admin only)
 *     operationId: getClassDetail
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Lấy toàn bộ thông tin chi tiết của 1 lớp bao gồm PT, mô tả, lịch học.
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Lấy chi tiết lớp học thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 class:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "Yoga Buổi Sáng"
 *                     category:
 *                       type: string
 *                       example: "yoga"
 *                     subcategory:
 *                       type: string
 *                       example: "Vinyasa Flow"
 *                     description:
 *                       type: string
 *                       example: "Lớp yoga nhẹ nhàng phù hợp cho mọi lứa tuổi"
 *                     capacity:
 *                       type: integer
 *                       example: 15
 *                     currentEnrollment:
 *                       type: integer
 *                       example: 8
 *                     status:
 *                       type: string
 *                       example: "scheduled"
 *                       enum: ["draft", "scheduled", "ongoing", "completed", "cancelled"]
 *                     location:
 *                       type: string
 *                       example: "Phòng 101"
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-25T07:00:00Z"
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-25T08:00:00Z"
 *                     staffId:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                         name:
 *                           type: string
 *                           example: "PT Nguyễn Văn A"
 *                         phone:
 *                           type: string
 *                           example: "0912345678"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-23T10:30:00Z"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - Lớp học không tồn tại
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to get class detail"
 *                 error:
 *                   type: string
 */
router.get('/:classId', authMiddleware, adminMiddleware, getClassDetail);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   patch:
 *     summary: Cập nhật thông tin lớp học (Admin only)
 *     operationId: updateClass
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin cập nhật thông tin chi tiết của lớp học (name, category, capacity, lịch học, vị trí, mô tả).
 *
 *       ✅ **Quy tắc cập nhật:**
 *       - Chỉ cập nhật các trường được gửi (optional)
 *       - name: 2-100 ký tự
 *       - capacity: 1-100
 *       - category: workout, cardio, stretching, nutrition, yoga, other
 *       - startTime/endTime: ISO 8601, duration ≥ 15 minutes
 *       - Không được cập nhật staffId, status qua endpoint này
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
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
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Yoga Buổi Sáng"
 *               category:
 *                 type: string
 *                 enum: [workout, cardio, stretching, nutrition, yoga, other]
 *                 example: "yoga"
 *               subcategory:
 *                 type: string
 *                 example: "Vinyasa Flow"
 *               capacity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 20
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-25T08:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-25T09:00:00Z"
 *               description:
 *                 type: string
 *                 example: "Lớp yoga nhẹ nhàng phù hợp cho mọi lứa tuổi"
 *               location:
 *                 type: string
 *                 example: "Phòng 101"
 *     responses:
 *       200:
 *         description: Cập nhật lớp học thành công
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
 *                   example: "Class updated successfully"
 *                 class:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     name:
 *                       type: string
 *                       example: "Yoga Buổi Sáng"
 *       400:
 *         description: Bad Request - Validation error
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
 *                   example: "Validation error"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       error:
 *                         type: string
 *                       message:
 *                         type: string
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền cập nhật
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - Lớp học không tồn tại
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to update class"
 *                 error:
 *                   type: string
 */
router.patch('/:classId', authMiddleware, adminMiddleware, updateClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/open:
 *   patch:
 *     summary: Mở lớp để nhận đăng ký (Admin only)
 *     operationId: openClass
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin chuyển lớp từ trạng thái **draft** sang **scheduled** để cho phép học viên đăng ký tham gia.
 *
 *       ✅ **Điều kiện:**
 *       - Lớp hiện tại phải ở trạng thái 'draft'
 *       - Có thể mở lớp bất kỳ lúc nào nếu chưa bắt đầu
 *
 *       📊 **Quy trình:**
 *       1. Admin gọi endpoint mở lớp
 *       2. Kiểm tra status = 'draft'
 *       3. Cập nhật status = 'scheduled'
 *       4. Học viên có thể bắt đầu đăng ký lớp
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Class opened successfully"
 *                 class:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     status:
 *                       type: string
 *                       example: "scheduled"
 *       400:
 *         description: Bad Request - Lớp không thể mở
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
 *                   example: "Class cannot be opened - not in draft status"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền mở lớp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - Lớp học không tồn tại
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to open class"
 *                 error:
 *                   type: string
 */
router.patch('/:classId/open', authMiddleware, adminMiddleware, openClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/close:
 *   patch:
 *     summary: Đóng lớp học (Admin only)
 *     operationId: closeClass
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin đóng lớp học và xác định lý do: hoàn thành (completed) hoặc hủy (cancelled).
 *
 *       ✅ **Điều kiện:**
 *       - Lớp phải ở trạng thái 'scheduled' hoặc 'ongoing'
 *       - Không thể đóng lớp đã là completed/cancelled
 *
 *       📊 **Trạng thái lớp sau khi đóng:**
 *       - completed: Lớp kết thúc bình thường
 *       - cancelled: Lớp bị hủy (hoàn tiền cho học viên)
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
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
 *                 enum: [completed, cancelled]
 *                 description: Lý do đóng lớp học
 *                 example: "completed"
 *     responses:
 *       200:
 *         description: Đóng lớp học thành công
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
 *                   example: "Class closed successfully"
 *                 class:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     status:
 *                       type: string
 *                       example: "completed"
 *       400:
 *         description: Bad Request - Lớp không thể đóng
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
 *                   example: "Class cannot be closed - already completed or cancelled"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền đóng lớp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - Lớp học không tồn tại
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to close class"
 *                 error:
 *                   type: string
 */
router.patch('/:classId/close', authMiddleware, adminMiddleware, closeClass);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   delete:
 *     summary: Xóa lớp học (Admin only)
 *     operationId: deleteClass
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin xóa hoàn toàn lớp học khỏi hệ thống.
 *
 *       ⚠️ **Điều kiện:**
 *       - Lớp phải ở trạng thái 'draft' (chỉ có thể xóa lớp chưa mở)
 *       - Không thể xóa lớp đã mở, đang diễn ra hoặc hoàn thành
 *       - Nếu lớp có học viên đăng ký, phải hủy trước
 *
 *       ⚠️ **Lưu ý:**
 *       - Xóa sẽ xóa vĩnh viễn, không thể hoàn tác
 *       - Kiểm kỹ trước khi xóa
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Class deleted successfully"
 *       400:
 *         description: Bad Request - Lớp không thể xóa
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
 *                   example: "Class cannot be deleted - not in draft status or has enrollments"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền xóa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - Lớp học không tồn tại
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống
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
 *                   example: "Failed to delete class"
 *                 error:
 *                   type: string
 */
router.delete('/:classId', authMiddleware, adminMiddleware, deleteClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/qrcode:
 *   post:
 *     summary: Tạo QR code check-in/out cho lớp học (Admin only)
 *     operationId: generateClassQRCode
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Tạo mới hoặc làm mới mã QR code cho lớp học, dùng để điểm danh check-in/out.
 *
 *       🔐 **Quy tắc:**
 *       - Chỉ tạo được khi lớp đang ở trạng thái `scheduled` hoặc `ongoing`.
 *       - QR code cũ (nếu có) sẽ bị thay thế và xóa khỏi Cloudinary.
 *       - Payload bên trong QR code chứa `classId`, `token` ngẫu nhiên và dấu thời gian tạo.
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       201:
 *         description: QR code tạo thành công
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
 *                   example: "QR code generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     classId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     className:
 *                       type: string
 *                       example: "Yoga Buổi Sáng"
 *                     qrCode:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                           example: "https://res.cloudinary.com/demo/qrcode/sample.png"
 *                         cloudinary_id:
 *                           type: string
 *                           example: "gymxfit/class-qrcodes/class_507f1f77_qrcode"
 *                         value:
 *                           type: string
 *                           description: Chuỗi payload (JSON) được encode trong QR code
 *                         generatedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Yêu cầu không hợp lệ (classId sai, trạng thái lớp không phù hợp)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "invalid_class_status"
 *                 message:
 *                   type: string
 *                   example: "QR code can only be generated for classes that are scheduled or ongoing"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền tạo QR code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Không tìm thấy lớp học
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi khi tạo hoặc upload QR code
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
 *                   example: "Failed to generate class QR code"
 *                 error:
 *                   type: string
 */
router.post('/:classId/qrcode', authMiddleware, adminMiddleware, generateClassQRCode);

/**
 * @swagger
 * /api/admin/classes/{classId}/qrcode:
 *   get:
 *     summary: Lấy QR code check-in lớp học (Admin only)
 *     operationId: getClassQRCode
 *     tags: [Classes (Admin)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin lấy QR code của lớp học để in hoặc chia sẻ cho học viên check-in.
 *
 *       ✅ **QR code sử dụng để:**
 *       - Check-in điểm danh học viên khi vào lớp
 *       - Xác nhận sự tham gia của học viên
 *       - Tự động ghi nhận vào hệ thống
 *
 *       📊 **Dữ liệu trả về:**
 *       - classId: ID lớp học
 *       - className: Tên lớp học
 *       - qrCode: URL ảnh QR code từ Cloudinary
 *       - cloudinary_id: ID quản lý trên Cloudinary
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId)
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Lấy QR code thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     classId:
 *                       type: string
 *                       example: "507f1f77bcf86cd799439013"
 *                     className:
 *                       type: string
 *                       example: "Yoga Buổi Sáng"
 *                     qrCode:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                           example: "https://res.cloudinary.com/demo/qrcode/sample.png"
 *                         cloudinary_id:
 *                           type: string
 *                           example: "gym-fitness/class_qrcode_507f1f77"
 *       400:
 *         description: Bad Request - QR code chưa sẵn sàng
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
 *                   example: "QR code not available - class must be scheduled"
 *       401:
 *         description: Unauthorized - Token không hợp lệ hoặc hết hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới có quyền lấy QR code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       404:
 *         description: Not Found - Lớp học không tồn tại
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
 *                   example: "Class not found"
 *       500:
 *         description: Server Error - Lỗi hệ thống (Cloudinary hoặc DB)
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
 *                   example: "Failed to generate QR code"
 *                 error:
 *                   type: string
 */
router.get('/:classId/qrcode', authMiddleware, adminMiddleware, getClassQRCode);

module.exports = router;
