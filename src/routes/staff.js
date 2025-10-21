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
 *       4. Skills cần admin approve trước khi PT được gán vào lớp
 *       
 *       📋 **Skills (chuyên môn PT):**
 *       - workout, cardio, stretching, nutrition, yoga, other
 *       - Phải match với Category của Video
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
 *                 example: ["Yoga", "CrossFit"]
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
 *                       example: ["Yoga", "CrossFit"]
 *                     skillsApprovedByAdmin:
 *                       type: boolean
 *                       example: false
 *                       description: Skills cần admin approve
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
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
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
 *         description: Chi tiết PT
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 staff:
 *                   type: object
 *       404:
 *         description: PT not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *         description: PT account activated
 *       404:
 *         description: PT not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *         description: PT account deactivated
 *       404:
 *         description: PT not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *         description: PT skills approved
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
 *                     phone:
 *                       type: string
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                     skillsApprovedByAdmin:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: PT not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/:staffId/skills/approve', authMiddleware, adminMiddleware, approveStaffSkills);

module.exports = router;
