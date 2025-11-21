// routes/enrollment.js
const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  customerAttendanceScan
} = require('../controllers/classAttendanceController');

/**
 * @swagger
 * tags:
 *   name: Class Enrollment
 *   description: Customer đăng ký và quản lý lớp học đã đăng ký
 */

// Customer endpoints
/**
 * @swagger
 * /api/customer/classes/{classId}/enroll:
 *   post:
 *     tags: [Class Enrollment]
 *     summary: Đăng ký lớp học
 *     operationId: enrollClass
 *     description: |
 *       Customer đăng ký một lớp học.
 *
 *       ✅ **Yêu cầu:**
 *       - Authorization: Bearer token (Customer role)
 *       - Class ID phải tồn tại và còn mở đăng ký
 *
 *       🔑 **Logic:**
 *       - Kiểm tra class tồn tại và còn mở
 *       - Kiểm tra customer chưa đăng ký class này
 *       - Tạo enrollment với status = 'active'
 *       - Cập nhật currentEnrollment trong class
 *
 *       ⏰ **Time:** Class phải bắt đầu trong tương lai
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Class ID (MongoDB ObjectId)
 *         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *     responses:
 *       201:
 *         description: Đăng ký lớp học thành công
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
 *                   example: "Enrolled in class successfully"
 *                 enrollment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     customerId:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2f"
 *                     classId:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     status:
 *                       type: string
 *                       example: "active"
 *                       enum: ["active", "completed", "cancelled"]
 *                     enrolledAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-23T10:30:00Z"
 *       400:
 *         description: Bad Request - Lỗi validation hoặc class không thể đăng ký
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
 *                   example: "Class is full"
 *       404:
 *         description: Not Found - Không tìm thấy lớp học
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
 *       409:
 *         description: Conflict - Customer đã đăng ký lớp này rồi
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
 *                   example: "Already enrolled in this class"
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
 *         description: Forbidden - Chỉ customer mới được đăng ký lớp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Customer access required"
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
 *                   example: "Failed to enroll in class"
 *                 error:
 *                   type: string
 */
router.post('/classes/:classId/enroll', authMiddleware, enrollmentController.enrollClass);

/**
 * @swagger
 * /api/customer/classes/{classId}/attendance/scan:
 *   post:
 *     tags: [Class Enrollment]
 *     summary: Quét QR điểm danh (tự động check-in/check-out)
 *     description: |
 *       Người dùng chỉ cần quét cùng một QR code khi vào lớp và khi ra về.
 *       - Lần quét **đầu tiên** được ghi nhận làm **check-in** và sẽ không bao giờ bị ghi đè.
 *       - Các lần quét **tiếp theo** sẽ cập nhật **check-out**, luôn giữ thời điểm của lần quét cuối cùng.
 *     operationId: customerClassAttendanceScan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: ID lớp học
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrValue]
 *             properties:
 *               qrValue:
 *                 type: string
 *                 description: Payload JSON đọc được từ QR code lớp
 *                 example: '{"classId":"507f1f77bcf86cd799439013","token":"abcd1234","type":"class_check","generatedAt":"2025-01-01T08:00:00.000Z"}'
 *     responses:
 *       200:
 *         description: Ghi nhận điểm danh thành công (trả về trạng thái check-in/check-out mới nhất)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Check-in recorded" }
 *                 attendance:
 *                   type: object
 *                   properties:
 *                     checkInAt:
 *                       type: string
 *                       format: date-time
 *                     checkOutAt:
 *                       type: string
 *                       format: date-time
 *                     lastAction:
 *                       type: string
 *                       enum: [check_in, check_out]
 *       400:
 *         description: QR code không hợp lệ hoặc chưa đến cửa sổ check-in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "invalid_qr" }
 *                 message: { type: string }
 *       401:
 *         description: Thiếu token đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "unauthorized" }
 *                 message: { type: string }
 *       403:
 *         description: Người dùng chưa đăng ký lớp này hoặc không có quyền
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "not_enrolled" }
 *                 message: { type: string }
 *       409:
 *         description: Lớp đã kết thúc và quá thời hạn check-out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "class_finished" }
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy lớp hoặc QR code tương ứng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "class_not_found" }
 *                 message: { type: string }
 *       500:
 *         description: Lỗi hệ thống khi ghi nhận điểm danh
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "server_error" }
 *                 message: { type: string }
 */
router.post('/classes/:classId/attendance/scan', authMiddleware, customerAttendanceScan);

// Legacy routes (giữ để tương thích, dùng chung logic scan)
router.post('/classes/:classId/check-in', authMiddleware, customerAttendanceScan);
router.post('/classes/:classId/check-out', authMiddleware, customerAttendanceScan);

/**
 * @swagger
 * /api/customer/classes/search:
 *   get:
 *     tags: [Class Enrollment]
 *     summary: 🔍 Tìm kiếm lớp học có sẵn
 *     operationId: searchClasses
 *     description: |
 *       Tìm kiếm các lớp học đang mở đăng ký cho customer.
 *
 *       ✅ **Khả năng tìm kiếm:**
 *       - Filter theo danh mục (category): workout, cardio, yoga, etc.
 *       - Filter theo địa điểm (location)
 *       - Filter theo khoảng thời gian (startDate, endDate)
 *       - Search theo tên lớp, mô tả, địa điểm
 *       - Phân trang và sắp xếp linh hoạt
 *
 *       🔑 **Thông tin trả về:**
 *       - Thông tin chi tiết lớp học
 *       - Số chỗ trống còn lại
 *       - Thông tin PT giảng dạy
 *       - Đã đăng ký hay chưa (nếu đã login)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [workout, cardio, stretching, nutrition, yoga, other]
 *         description: Filter theo danh mục lớp học
 *         example: "yoga"
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter theo địa điểm (tìm kiếm tương đối)
 *         example: "Hà Nội"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Lớp bắt đầu từ thời điểm này (ISO 8601)
 *         example: "2025-10-25T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Lớp bắt đầu đến thời điểm này (ISO 8601)
 *         example: "2025-10-31T23:59:59Z"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên lớp, mô tả, địa điểm, danh mục con
 *         example: "yoga buổi sáng"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Số lớp học mỗi trang
 *         example: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [startTime, endTime, createdAt, name, capacity, currentEnrollment]
 *           default: startTime
 *         description: Sắp xếp theo trường
 *         example: "startTime"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Thứ tự sắp xếp
 *         example: "asc"
 *     responses:
 *       200:
 *         description: Tìm kiếm lớp học thành công
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
 *                   example: "Classes found successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       classId:
 *                         type: string
 *                         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                       name:
 *                         type: string
 *                         example: "Yoga Buổi Sáng"
 *                       category:
 *                         type: string
 *                         example: "yoga"
 *                       subcategory:
 *                         type: string
 *                         example: "Vinyasa Flow"
 *                       description:
 *                         type: string
 *                         example: "Lớp yoga nhẹ nhàng cho người mới bắt đầu"
 *                       location:
 *                         type: string
 *                         example: "Phòng 101 - Tầng 2"
 *                       capacity:
 *                         type: integer
 *                         example: 20
 *                       currentEnrollment:
 *                         type: integer
 *                         example: 8
 *                       availableSpots:
 *                         type: integer
 *                         example: 12
 *                       isFull:
 *                         type: boolean
 *                         example: false
 *                       startTime:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-25T07:00:00Z"
 *                       endTime:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-25T08:00:00Z"
 *                       status:
 *                         type: string
 *                         example: "scheduled"
 *                       instructor:
 *                         type: object
 *                         properties:
 *                           staffId:
 *                             type: string
 *                           name:
 *                             type: string
 *                             example: "PT Nguyễn Văn A"
 *                           email:
 *                             type: string
 *                             example: "pt.na@example.com"
 *                           skills:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["yoga", "meditation"]
 *                       isEnrolledByUser:
 *                         type: boolean
 *                         description: User đã đăng ký lớp này chưa (chỉ có khi login)
 *                         example: false
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     pages:
 *                       type: integer
 *                       example: 5
 *                 filters:
 *                   type: object
 *                   properties:
 *                     category:
 *                       type: string
 *                       example: "yoga"
 *                     location:
 *                       type: string
 *                       example: "Hà Nội"
 *                     search:
 *                       type: string
 *                       example: "yoga buổi sáng"
 *       400:
 *         description: Bad Request - Parameter không hợp lệ
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
 *                   example: "Invalid category. Must be one of: workout, cardio, stretching, nutrition, yoga, other"
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
 *                   example: "Failed to search classes"
 *                 error:
 *                   type: string
 */
router.get('/classes/search', authMiddleware, enrollmentController.searchClasses);

/**
 * @swagger
 * /api/customer/enrollments:
 *   get:
 *     tags: [Class Enrollment]
 *     summary: Danh sách lớp đã đăng ký
 *     operationId: getMyEnrollments
 *     description: |
 *       Lấy danh sách tất cả lớp customer đã đăng ký.
 *
 *       📖 **Pagination:** page, limit
 *       🏷️ **Filter:** status (active, completed, cancelled)
 *       📅 **Sorting:** Mới nhất trước
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter theo trạng thái enrollment
 *         example: "active"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số enrollment mỗi trang
 *         example: 10
 *     responses:
 *       200:
 *         description: Lấy danh sách enrollment thành công
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
 *                         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                       classId:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           category:
 *                             type: string
 *                           startTime:
 *                             type: string
 *                             format: date-time
 *                           endTime:
 *                             type: string
 *                             format: date-time
 *                       status:
 *                         type: string
 *                         example: "active"
 *                         enum: ["active", "completed", "cancelled"]
 *                       enrolledAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-10-23T10:30:00Z"
 *                       cancellationReason:
 *                         type: string
 *                         example: null
 *                       cancelledAt:
 *                         type: string
 *                         format: date-time
 *                         example: null
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 25
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     pages:
 *                       type: number
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
 *         description: Forbidden - Chỉ customer mới được xem enrollments của mình
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Customer access required"
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
 *                   example: "Failed to get enrollments"
 *                 error:
 *                   type: string
 */
router.get('/enrollments', authMiddleware, enrollmentController.getMyEnrollments);

/**
 * @swagger
 * /api/customer/enrollments/{enrollmentId}:
 *   get:
 *     tags: [Class Enrollment]
 *     summary: Chi tiết enrollment
 *     operationId: getEnrollmentDetail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Enrollment ID (MongoDB ObjectId)
 *         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *     responses:
 *       200:
 *         description: Lấy chi tiết enrollment thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 enrollment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     customerId:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2f"
 *                     classId:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                         name:
 *                           type: string
 *                           example: "Yoga Class"
 *                         category:
 *                           type: string
 *                           example: "yoga"
 *                         startTime:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-10-25T10:00:00Z"
 *                         endTime:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-10-25T11:00:00Z"
 *                         staffId:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                               example: "PT Nguyễn Văn A"
 *                     status:
 *                       type: string
 *                       example: "active"
 *                       enum: ["active", "completed", "cancelled"]
 *                     enrolledAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-23T10:30:00Z"
 *                     cancellationReason:
 *                       type: string
 *                       example: null
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *                       example: null
 *       404:
 *         description: Not Found - Không tìm thấy enrollment
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
 *                   example: "Enrollment not found"
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
 *         description: Forbidden - Chỉ được xem enrollment của mình
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Access denied"
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
 *                   example: "Failed to get enrollment detail"
 *                 error:
 *                   type: string
 */
router.get('/enrollments/:enrollmentId', authMiddleware, enrollmentController.getEnrollmentDetail);

/**
 * @swagger
 * /api/customer/enrollments/{enrollmentId}/cancel:
 *   patch:
 *     tags: [Class Enrollment]
 *     summary: Hủy đăng ký lớp
 *     operationId: cancelEnrollment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enrollmentId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Enrollment ID (MongoDB ObjectId)
 *         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancellationReason:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Lịch trình không phù hợp"
 *                 description: Lý do hủy (optional)
 *     responses:
 *       200:
 *         description: Hủy enrollment thành công
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
 *                   example: "Enrollment cancelled successfully"
 *                 enrollment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     status:
 *                       type: string
 *                       example: "cancelled"
 *                     cancellationReason:
 *                       type: string
 *                       example: "Lịch trình không phù hợp"
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-23T10:30:00Z"
 *       404:
 *         description: Not Found - Không tìm thấy enrollment
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
 *                   example: "Enrollment not found"
 *       400:
 *         description: Bad Request - Enrollment không thể hủy
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
 *                   example: "Cannot cancel completed enrollment"
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
 *         description: Forbidden - Chỉ được hủy enrollment của mình
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Access denied"
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
 *                   example: "Failed to cancel enrollment"
 *                 error:
 *                   type: string
 */
router.patch('/enrollments/:enrollmentId/cancel', authMiddleware, enrollmentController.cancelEnrollment);

// Admin endpoint
/**
 * @swagger
 * /api/admin/classes/{classId}/enrollments:
 *   get:
 *     tags: [Class Enrollment]
 *     summary: Danh sách enrollments của lớp (Admin)
 *     operationId: getClassEnrollments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: Class ID (MongoDB ObjectId)
 *         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter theo trạng thái enrollment
 *         example: "active"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số enrollment mỗi trang
 *         example: 10
 *     responses:
 *       200:
 *         description: Lấy danh sách enrollments của lớp thành công
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
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     className:
 *                       type: string
 *                       example: "Morning HIIT"
 *                     classStatus:
 *                       type: string
 *                       example: "on_going"
 *                     capacity:
 *                       type: integer
 *                       example: 20
 *                     currentEnrollment:
 *                       type: integer
 *                       example: 12
 *                     availableSlots:
 *                       type: integer
 *                       example: 8
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                     location:
 *                       type: string
 *                       example: "Saigon Studio"
 *                     staff:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         staffId: { type: string }
 *                         name: { type: string }
 *                         email: { type: string }
 *                         phone: { type: string }
 *                         checkInAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         checkOutAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         checkInMethod:
 *                           type: string
 *                           nullable: true
 *                         checkOutMethod:
 *                           type: string
 *                           nullable: true
 *                     stats:
 *                       type: object
 *                       properties:
 *                         capacity:
 *                           type: integer
 *                           example: 20
 *                         registered:
 *                           type: integer
 *                           example: 12
 *                         checkedIn:
 *                           type: integer
 *                           example: 5
 *                         checkedOut:
 *                           type: integer
 *                           example: 3
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           enrollmentId:
 *                             type: string
 *                             example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                           user:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               userId: { type: string }
 *                               name: { type: string }
 *                               email: { type: string }
 *                               phone: { type: string }
 *                           status:
 *                             type: string
 *                             enum: ["active", "completed", "cancelled"]
 *                             example: "active"
 *                           enrolledAt:
 *                             type: string
 *                             format: date-time
 *                           cancelledAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           checkInAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           checkOutAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           checkInMethod:
 *                             type: string
 *                             nullable: true
 *                           checkOutMethod:
 *                             type: string
 *                             nullable: true
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 15
 *                     page:
 *                       type: number
 *                       example: 1
 *                     limit:
 *                       type: number
 *                       example: 10
 *                     pages:
 *                       type: number
 *                       example: 2
 *       404:
 *         description: Not Found - Không tìm thấy lớp học
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
 *         description: Forbidden - Chỉ admin mới được xem enrollments
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
 *                   example: "Failed to get class enrollments"
 *                 error:
 *                   type: string
 */
router.get('/classes/:classId/enrollments', authMiddleware, adminMiddleware, enrollmentController.getClassEnrollments);

module.exports = router;
