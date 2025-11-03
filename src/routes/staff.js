// routes/staff.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const {
  createStaff,
  getStaffList,
  getStaffDetail,
  activateStaff,
  deactivateStaff,
  approveStaffSkills,
  updateStaffAvatar
} = require('../controllers/staffController');

// --- Multer configuration for staff avatar uploads ---
const uploadDir = process.env.UPLOAD_AVATAR_DIR || path.join(os.tmpdir(), 'gymxfit-avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const targetId = req.params.staffId || req.user?.id || 'staff';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${targetId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WEBP files are allowed.'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

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
 * /api/admin/staff/{staffId}/avatar:
 *   put:
 *     summary: Upload hoặc cập nhật avatar cho PT
 *     operationId: updateStaffAvatar
 *     tags: [Staff (PT)]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Cho phép admin cập nhật avatar cho PT hoặc PT tự upload avatar của chính mình.
 *       - File ảnh phải gửi dưới dạng `multipart/form-data` với field `avatar`.
 *       - Định dạng hỗ trợ: JPEG, PNG, GIF, WEBP. Kích thước tối đa 5MB.
 *       - Avatar cũ (nếu có) sẽ bị xóa khỏi Cloudinary sau khi upload thành công.
 *       - PT có thể sử dụng endpoint này nếu cung cấp đúng `staffId` của chính mình.
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         description: ID của PT cần cập nhật avatar
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: "File ảnh đại diện (JPEG, PNG, GIF, WEBP - tối đa 5MB)"
 *     responses:
 *       200:
 *         description: Cập nhật avatar thành công
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
 *                   example: "Avatar updated successfully"
 *                 staff:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "58f5c0eb2a6d0c1a8f9b4c2e"
 *                     avatar:
 *                       type: string
 *                       format: uri
 *                       example: "https://res.cloudinary.com/.../avatar.jpg"
 *                     updatedByAdmin:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Thiếu file hoặc staffId không hợp lệ
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
 *                   example: "file_missing"
 *                 message:
 *                   type: string
 *                   example: "No image file provided"
 *       401:
 *         description: Không xác thực được người dùng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "unauthorized"
 *                 message:
 *                   type: string
 *                   example: "No token provided. Please login first."
 *       403:
 *         description: Không có quyền cập nhật avatar cho PT này
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
 *                   example: "forbidden"
 *                 message:
 *                   type: string
 *                   example: "Only admin or the PT owner can update this avatar"
 *       404:
 *         description: Không tìm thấy PT
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
 *                   example: "staff_not_found"
 *                 message:
 *                   type: string
 *                   example: "PT not found"
 *       500:
 *         description: Lỗi hệ thống khi upload avatar
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
 *                   example: "server_error"
 *                 message:
 *                   type: string
 *                   example: "Failed to update PT avatar"
 */
router.put('/:staffId/avatar', authMiddleware, upload.single('avatar'), updateStaffAvatar);

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
