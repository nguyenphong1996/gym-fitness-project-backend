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
 *   name: 📚 Classes (Class Management)
 *   description: Quản lý lớp học, lịch học, PT giảng dạy, enrollment và check-in. Admin tạo/quản lý, Customer đăng ký
 */

/**
 * @swagger
 * /api/admin/classes/create:
 *   post:
 *     summary: 🆕 Tạo lớp học mới (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
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
 *         description: |
 *           ❌ **Bad Request (400) - Validation Error hoặc PT không hợp lệ**
 *           
 *           **Validation errors:**
 *           - name: Quá ngắn (<2) hoặc quá dài (>100)
 *           - category: Không trong enum
 *           - capacity: < 1 hoặc > 100
 *           - startTime/endTime: Format sai, startTime ≥ endTime, duration < 15 phút
 *           - staffId: Format ObjectId sai
 *           
 *           **PT validation errors:**
 *           - PT không tồn tại (404)
 *           - PT role không phải 'staff'
 *           - PT chưa active (isActive=false)
 *           - PT chưa approve skills (skillsApprovedByAdmin=false)
 *       401:
 *         description: |
 *           🔐 **Unauthorized (401) - Authentication Failed**
 *           - Token không gửi
 *           - Token sai format (không "Bearer <token>")
 *           - Token hết hạn (expired)
 *       403:
 *         description: |
 *           🚫 **Forbidden (403) - Không phải admin**
 *           - User role không phải admin
 *       404:
 *         description: |
 *           ❌ **Not Found (404)**
 *           - PT (staffId) không tồn tại
 *       500:
 *         description: |
 *           ⚙️ **Server Error (500)**
 *           - Lỗi database
 */
router.post('/create', authMiddleware, adminMiddleware, createClass);

/**
 * @swagger
 * /api/admin/classes:
 *   get:
 *     summary: 📋 Lấy danh sách lớp học (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
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
 *     summary: 🔍 Xem chi tiết lớp học (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Lấy toàn bộ thông tin chi tiết của 1 lớp bao gồm PT, mô tả, lịch học, QR code.
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId 24 ký tự hex)
 *     responses:
 *       200:
 *         description: "✅ Lấy chi tiết lớp học thành công"
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
 *                       enum: [draft, scheduled, in-progress, completed, cancelled]
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
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     createdAt:
 *                       type: string
 *       401:
 *         description: 🔐 Unauthorized - Token không hợp lệ hoặc hết hạn
 *       403:
 *         description: 🚫 Forbidden - Chỉ admin mới có quyền truy cập
 *       404:
 *         description: ❌ Lớp học không tồn tại (classId sai)
 *       500:
 *         description: ⚙️ Server error - Lỗi hệ thống
 */
router.get('/:classId', authMiddleware, adminMiddleware, getClassDetail);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   patch:
 *     summary: ✏️ Cập nhật thông tin lớp học (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
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
 *         description: ID của lớp học (MongoDB ObjectId 24 ký tự hex)
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
 *                 example: "2024-12-20T08:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-20T09:00:00Z"
 *               description:
 *                 type: string
 *                 example: "Lớp yoga nhẹ nhàng phù hợp cho mọi lứa tuổi"
 *               location:
 *                 type: string
 *                 example: "Phòng 101"
 *     responses:
 *       200:
 *         description: "✅ Cập nhật lớp học thành công"
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
 *         description: |
 *           ❌ Validation error - Dữ liệu không hợp lệ:
 *           - name quá ngắn (< 2) hoặc quá dài (> 100)
 *           - capacity ngoài phạm vi (1-100)
 *           - category không phải giá trị hợp lệ
 *           - startTime/endTime định dạng sai
 *           - duration < 15 phút
 *           - startTime phải ≥ hiện tại
 *       401:
 *         description: 🔐 Unauthorized - Token không hợp lệ hoặc hết hạn
 *       403:
 *         description: 🚫 Forbidden - Chỉ admin mới có quyền cập nhật
 *       404:
 *         description: ❌ Lớp học không tồn tại (classId sai)
 *       500:
 *         description: ⚙️ Server error - Lỗi hệ thống
 */
router.patch('/:classId', authMiddleware, adminMiddleware, updateClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/open:
 *   patch:
 *     summary: 🟢 Mở lớp để nhận đăng ký (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
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
 *         description: ID của lớp học (MongoDB ObjectId 24 ký tự hex)
 *     responses:
 *       200:
 *         description: "✅ Mở lớp học thành công (status: draft -> scheduled)"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Mở lớp học thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [scheduled]
 *       400:
 *         description: |
 *           ❌ Bad request:
 *           - Lớp học không ở trạng thái 'draft' (không thể mở lớp đã mở)
 *           - Lớp học đã bắt đầu hoặc kết thúc
 *       401:
 *         description: 🔐 Unauthorized - Token không hợp lệ hoặc hết hạn
 *       403:
 *         description: 🚫 Forbidden - Chỉ admin mới có quyền mở lớp
 *       404:
 *         description: ❌ Lớp học không tồn tại (classId sai)
 *       500:
 *         description: ⚙️ Server error - Lỗi hệ thống
 */
router.patch('/:classId/open', authMiddleware, adminMiddleware, openClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/close:
 *   patch:
 *     summary: 🔴 Đóng lớp học (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Admin đóng lớp học và xác định lý do: hoàn thành (completed) hoặc hủy (cancelled).
 *       
 *       ✅ **Điều kiện:**
 *       - Lớp phải ở trạng thái 'scheduled' hoặc 'in-progress'
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
 *         description: ID của lớp học (MongoDB ObjectId 24 ký tự hex)
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
 *                 description: Lý do đóng lớp học (completed = hoàn thành, cancelled = hủy)
 *                 example: "completed"
 *     responses:
 *       200:
 *         description: "✅ Đóng lớp học thành công"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Đóng lớp học thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [completed, cancelled]
 *       400:
 *         description: |
 *           ❌ Bad request:
 *           - Lớp học đã ở trạng thái 'completed' hoặc 'cancelled' (không thể đóng lại)
 *           - reason không phải 'completed' hoặc 'cancelled'
 *           - Lớp ở trạng thái 'draft' (phải mở trước)
 *       401:
 *         description: 🔐 Unauthorized - Token không hợp lệ hoặc hết hạn
 *       403:
 *         description: 🚫 Forbidden - Chỉ admin mới có quyền đóng lớp
 *       404:
 *         description: ❌ Lớp học không tồn tại (classId sai)
 *       500:
 *         description: ⚙️ Server error - Lỗi hệ thống
 */
router.patch('/:classId/close', authMiddleware, adminMiddleware, closeClass);

/**
 * @swagger
 * /api/admin/classes/{classId}:
 *   delete:
 *     summary: 🗑️ Xóa lớp học (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
 *     description: |
 *       Admin xóa hoàn toàn lớp học khỏi hệ thống.
 *       
 *       ⚠️ **Điều kiện:**
 *       - Lớp phải ở trạng thái 'draft' (chỉ có thể xóa lớp chưa mở)
 *       - Không thể xóa lớp đã mở, đang diễn ra hoặc hoàn thành
 *       - Nếu lớp có học viên đăng ký, phải hủy trước
 *       
 *       💀 **Lưu ý:**
 *       - Xóa sẽ xóa vĩnh viễn, không thể hoàn tác
 *       - Kiểm kỹ trước khi xóa
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID của lớp học (MongoDB ObjectId 24 ký tự hex)
 *     responses:
 *       200:
 *         description: "✅ Xóa lớp học thành công"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: "Xóa lớp học thành công"
 *       400:
 *         description: |
 *           ❌ Bad request:
 *           - Lớp học không ở trạng thái 'draft' (không thể xóa lớp đã mở)
 *           - Lớp có học viên đăng ký (phải hủy trước)
 *       401:
 *         description: 🔐 Unauthorized - Token không hợp lệ hoặc hết hạn
 *       403:
 *         description: 🚫 Forbidden - Chỉ admin mới có quyền xóa
 *       404:
 *         description: ❌ Lớp học không tồn tại (classId sai)
 *       500:
 *         description: ⚙️ Server error - Lỗi hệ thống
 */
router.delete('/:classId', authMiddleware, adminMiddleware, deleteClass);

/**
 * @swagger
 * /api/admin/classes/{classId}/qrcode:
 *   get:
 *     summary: 📱 Lấy QR code check-in lớp học (Admin only)
 *     tags: [📚 Classes (Class Management)]
 *     security:
 *       - BearerAuth: []
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
 *         description: ID của lớp học (MongoDB ObjectId 24 ký tự hex)
 *     responses:
 *       200:
 *         description: "✅ Lấy QR code thành công"
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
 *                       example: "507f1f77bcf86cd799439011"
 *                     className:
 *                       type: string
 *                       example: "Yoga Buổi Sáng"
 *                     qrCode:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                           example: "https://res.cloudinary.com/.../qrcode.png"
 *                         cloudinary_id:
 *                           type: string
 *                           example: "gym-fitness/class_qrcode_507f1f77"
 *       400:
 *         description: |
 *           ❌ Bad request:
 *           - Lớp học chưa có QR code (chưa tạo)
 *           - QR code bị lỗi hoặc không có sẵn
 *       401:
 *         description: 🔐 Unauthorized - Token không hợp lệ hoặc hết hạn
 *       403:
 *         description: 🚫 Forbidden - Chỉ admin mới có quyền lấy QR code
 *       404:
 *         description: ❌ Lớp học không tồn tại (classId sai)
 *       500:
 *         description: ⚙️ Server error - Lỗi hệ thống (Cloudinary hoặc DB)
 */
router.get('/:classId/qrcode', authMiddleware, adminMiddleware, getClassQRCode);

module.exports = router;
