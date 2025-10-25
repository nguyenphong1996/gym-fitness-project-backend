// routes/staff.js

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  createStaff,
  getStaffList,
  getStaffDetail,
  activateStaff,
  deactivateStaff,
  approveStaffSkills
} = require('../controllers/staffController');

/**
 * @swagger
 * tags:
 *   name: Staff (PT)
 *   description: Quản lý tài khoản PT (Personal Trainer) - Admin only
 */

/**
 * @swagger
 * /api/admin/staff/create:
 *   post:
 *     summary: Tạo tài khoản PT mới (Admin only)
 *     operationId: createStaff
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin tạo tài khoản PT mới. 
 *       
 *       ✅ **Yêu cầu:**
 *       - Authorization: Bearer token (Admin role)
 *       - Phone và Name bắt buộc
 *       - Skills bắt buộc (ít nhất 1 skill)
 *       - Email, Profile (dob, gender, height, weight) là optional
 *       
 *       🔑 **Quy trình:**
 *       1. Admin tạo tài khoản (không cần OTP)
 *       2. PT account tạo xong, isVerified = false
 *       3. Khi PT login lần đầu → cần OTP
 *       4. Skills được auto-approve khi admin tạo (vì admin đã xác nhận)
 *       
 *       📋 **Skills (chuyên môn PT):**
 *       - workout, cardio, stretching, nutrition, yoga, other
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - name
 *               - skills
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^0\d{9}$'
 *                 example: "0912345678"
 *                 description: Số điện thoại (10 chữ số, bắt đầu bằng 0, unique)
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Phạm Thế Vũ"
 *                 description: Họ tên PT (2-100 ký tự)
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "vupham@gmail.com"
 *                 description: Email (optional, unique)
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: ['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other']
 *                 minItems: 1
 *                 example: ["yoga", "stretching"]
 *                 description: |
 *                   Chuyên môn của PT (bắt buộc, ít nhất 1)
 *                   - workout: Tập luyện thể hình
 *                   - cardio: Cardio
 *                   - stretching: Xoa dãn
 *                   - nutrition: Dinh dưỡng
 *                   - yoga: Yoga
 *                   - other: Khác
 *               gender:
 *                 type: string
 *                 enum: ['male', 'female', 'other']
 *                 example: "male"
 *                 description: Giới tính (optional)
 *               dob:
 *                 type: string
 *                 format: date
 *                 example: "1995-01-15"
 *                 description: Ngày sinh (optional, format YYYY-MM-DD)
 *               height:
 *                 type: number
 *                 minimum: 100
 *                 maximum: 250
 *                 example: 180
 *                 description: Chiều cao (optional, 100-250 cm)
 *               weight:
 *                 type: number
 *                 minimum: 30
 *                 maximum: 200
 *                 example: 75
 *                 description: Cân nặng (optional, 30-200 kg)
 *     responses:
 *       201:
 *         description: PT account created successfully
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
 *                   example: "PT account created successfully"
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     name:
 *                       type: string
 *                       example: "Phạm Thế Vũ"
 *                     email:
 *                       type: string
 *                       example: "vupham@gmail.com"
 *                     role:
 *                       type: string
 *                       example: "staff"
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["yoga", "stretching"]
 *                     skillsApprovedByAdmin:
 *                       type: boolean
 *                       example: true
 *                       description: Skills đã được admin approve (auto-approve khi tạo)
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *                     hireDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *       400:
 *         description: Validation error
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
 *       409:
 *         description: Conflict - Phone or email already exists
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
 *                   example: "Phone number already exists"
 *       401:
 *         description: Unauthorized - Token không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       403:
 *         description: Forbidden - Chỉ admin mới được tạo PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server error
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
 *                   example: "Failed to create PT account"
 *                 error:
 *                   type: string
 */
router.post('/create', authMiddleware, adminMiddleware, createStaff);

/**
 * @swagger
 * /api/admin/staff:
 *   get:
 *     summary: Lấy danh sách PT (Admin only)
 *     operationId: getStaffList
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Lấy danh sách tất cả PT với phân trang và filter
 *       
 *       📖 **Pagination:** page, limit
 *       🏷️ **Filter:** active (true/false), skillsApproved (true/false)
 *       📅 **Sorting:** Mới nhất trước
 *     parameters:
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
 *         description: Số PT mỗi trang
 *         example: 10
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter theo trạng thái kích hoạt
 *         example: "true"
 *       - in: query
 *         name: skillsApproved
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter theo trạng thái xác nhận skills
 *         example: "false"
 *     responses:
 *       200:
 *         description: Danh sách PT
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
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     pages:
 *                       type: number
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
 *         description: Forbidden - Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server error - Lỗi hệ thống
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
 *                   example: "Failed to get staff list"
 *                 error:
 *                   type: string
 */
router.get('/', authMiddleware, adminMiddleware, getStaffList);

/**
 * @swagger
 * /api/admin/staff/{staffId}:
 *   get:
 *     summary: Lấy chi tiết PT (Admin only)
 *     operationId: getStaffDetail
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *         description: PT ID (MongoDB ObjectId)
 *         example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *     responses:
 *       200:
 *         description: Lấy chi tiết PT thành công
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
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     name:
 *                       type: string
 *                       example: "Phạm Thế Vũ"
 *                     email:
 *                       type: string
 *                       example: "vupham@gmail.com"
 *                     role:
 *                       type: string
 *                       example: "staff"
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["yoga", "stretching"]
 *                     skillsApprovedByAdmin:
 *                       type: boolean
 *                       example: true
 *                       description: Skills đã được admin approve
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     isVerified:
 *                       type: boolean
 *                       example: false
 *                       description: PT đã login lần đầu chưa
 *                     gender:
 *                       type: string
 *                       example: "male"
 *                     dob:
 *                       type: string
 *                       format: date
 *                       example: "1995-01-15"
 *                     height:
 *                       type: number
 *                       example: 180
 *                     weight:
 *                       type: number
 *                       example: 75
 *                     hireDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-21T10:30:00Z"
 *       404:
 *         description: PT not found - Không tìm thấy PT
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
 *         description: Forbidden - Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server error - Lỗi hệ thống
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
 *                   example: "Failed to get PT detail"
 *                 error:
 *                   type: string
 */
router.get('/:staffId', authMiddleware, adminMiddleware, getStaffDetail);

/**
 * @swagger
 * /api/admin/staff/{staffId}/activate:
 *   patch:
 *     summary: Kích hoạt tài khoản PT (Admin only)
 *     operationId: activateStaff
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *     responses:
 *       200:
 *         description: Kích hoạt tài khoản PT thành công
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
 *                   example: "PT account activated"
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: PT not found - Không tìm thấy PT
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
 *         description: Forbidden - Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server error - Lỗi hệ thống
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
 *                   example: "Failed to activate PT account"
 *                 error:
 *                   type: string
 */
router.patch('/:staffId/activate', authMiddleware, adminMiddleware, activateStaff);

/**
 * @swagger
 * /api/admin/staff/{staffId}/deactivate:
 *   patch:
 *     summary: Vô hiệu hóa tài khoản PT (Admin only)
 *     operationId: deactivateStaff
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *     responses:
 *       200:
 *         description: Vô hiệu hóa tài khoản PT thành công
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
 *                   example: "PT account deactivated"
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     isActive:
 *                       type: boolean
 *                       example: false
 *       404:
 *         description: PT not found - Không tìm thấy PT
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
 *         description: Forbidden - Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server error - Lỗi hệ thống
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
 *                   example: "Failed to deactivate PT account"
 *                 error:
 *                   type: string
 */
router.patch('/:staffId/deactivate', authMiddleware, adminMiddleware, deactivateStaff);

/**
 * @swagger
 * /api/admin/staff/{staffId}/skills/approve:
 *   patch:
 *     summary: Xác nhận skills của PT (Admin only)
 *     operationId: approveStaffSkills
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Admin xác nhận skills của PT. 
 *       Sau khi xác nhận, PT có thể được gán vào lớp học có skill tương ứng
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-f]{24}$'
 *     responses:
 *       200:
 *         description: Xác nhận skills PT thành công
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
 *                   example: "PT skills approved"
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     phone:
 *                       type: string
 *                       example: "0912345678"
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["yoga", "stretching"]
 *                     skillsApprovedByAdmin:
 *                       type: boolean
 *                       example: true
 *                       description: Skills đã được admin approve
 *       404:
 *         description: PT not found - Không tìm thấy PT
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
 *         description: Forbidden - Chỉ admin mới được truy cập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Forbidden - Admin access required"
 *       500:
 *         description: Server error - Lỗi hệ thống
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
 *                   example: "Failed to approve PT skills"
 *                 error:
 *                   type: string
 */
router.patch('/:staffId/skills/approve', authMiddleware, adminMiddleware, approveStaffSkills);

module.exports = router;
