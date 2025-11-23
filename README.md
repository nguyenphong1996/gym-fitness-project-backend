# Gym Fitness Project Backend

Backend API - Xác thực OTP qua SMS, Quản lý User Profile, Class Management, Staff PT Management & Delete Account & Upload video

## 📚 API Documentation

**Swagger UI:** http://localhost:3000/api-docs  
**Production:** https://be.vnchack.com/api-docs

### Authentication Endpoints:
- `POST /api/auth/register` - Gửi OTP đăng ký
- `POST /api/auth/verify-register` - Xác thực OTP & tạo tài khoản
- `POST /api/auth/login` - Gửi OTP đăng nhập
- `POST /api/auth/verify-login` - Xác thực OTP & đăng nhập

### Staff Authentication (PT self-service):
- `POST /api/staff/auth/request-otp` - PT yêu cầu OTP cho `first_login` hoặc `login`
  - Body: `{ phone, purpose: "first_login" | "login" }`
  - Trả về sessionId, expiresIn, dev_otp (sandbox)
- `POST /api/staff/auth/verify-otp` - PT xác thực OTP & nhận JWT
  - Body: `{ phone, code, purpose }`
  - Response: `{ token, user: { id, phone, role, isVerified, isActive } }`

### Staff Self-Service Profile:
- `GET /api/staff/profile` - Lấy thông tin hồ sơ + trạng thái yêu cầu kỹ năng (JWT staff)
- `PUT /api/staff/profile` - Cập nhật name/email/gender/dob/weight/height (JWT staff)
- `PUT /api/staff/profile/avatar` - Upload avatar mới (multipart/form-data, JWT staff)
- `PUT /api/staff/profile/skills` - Gửi yêu cầu cập nhật kỹ năng, chờ admin duyệt (JWT staff)
- `GET /api/staff/bookings` - PT xem lịch book riêng (lọc theo ngày/from/to)


### User Profile Endpoints:
- `GET /api/user/profile` - Lấy thông tin profile (JWT required)
- `PUT /api/user/profile` - Cập nhật profile: name, email, avatarUrl, gender, dob, weight, height (JWT required)

### Delete Account Endpoints:
- `POST /api/user/account/delete/request` - Gửi OTP xác nhận vô hiệu hóa tài khoản (JWT required)
- `DELETE /api/user/account/delete/confirm` - Xác nhận OTP & vô hiệu hóa tài khoản khách hàng (JWT required)

### Staff (PT) Management Endpoints (Admin only):
- `POST /api/admin/staff/create` - Tạo tài khoản PT mới (JWT admin required)
  - Body: `{ phone, name, skills[], email?, gender?, dob?, height?, weight? }`
  - Response: `{ staff: { _id, phone, name, email, role, skills, skillsApprovedByAdmin, isActive, isVerified, createdAt } }`
- `GET /api/admin/staff` - Lấy danh sách PT (JWT admin required)
  - Query: `?page=1&limit=10&active=true&skillsApproved=false`
  - Response: `{ data: [...], pagination: { total, page, limit, pages } }`
- `GET /api/admin/staff/{staffId}` - Xem chi tiết PT (JWT admin required)
  - Response: `{ data: { _id, phone, name, email, role, skills, skillsApprovedByAdmin, isActive, ... } }`
- `PATCH /api/admin/staff/{staffId}/activate` - Kích hoạt tài khoản PT (JWT admin required)
- `PATCH /api/admin/staff/{staffId}/deactivate` - Vô hiệu hóa tài khoản PT (JWT admin required)
- `PATCH /api/admin/staff/{staffId}/skills/approve` - Duyệt kỹ năng PT (từ yêu cầu pending hoặc payload)
- `PATCH /api/admin/staff/{staffId}/skills/reject` - Từ chối yêu cầu cập nhật kỹ năng PT (JWT admin required)

### Class Management Endpoints (Admin only):
- `POST /api/admin/classes/create` - Tạo lớp học mới (JWT admin required)
  - Body: `{ name, category, capacity, startTime, endTime, staffId, subcategory?, description?, location? }`
  - Response: `{ data: { _id, name, category, capacity, currentEnrollment, status, startTime, endTime, staffId, ... } }`
- `GET /api/admin/classes` - Lấy danh sách lớp học (JWT admin required)
  - Query: `?page=1&limit=10&status=scheduled&category=workout&staffId=xxx`
  - Response: `{ data: [...], pagination: { total, page, limit, pages } }`
- `GET /api/admin/classes/{classId}` - Xem chi tiết lớp học (JWT admin required)
  - Response: `{ data: { _id, name, category, capacity, currentEnrollment, status, staffId, qrCode?, ... } }`
- `PATCH /api/admin/classes/{classId}` - Cập nhật thông tin lớp học (JWT admin required)
  - Body: `{ name?, category?, subcategory?, capacity?, startTime?, endTime?, description?, location?, staffId? }`
  - Ghi chú:
    - Chỉ các trường gửi lên mới được cập nhật.
    - `staffId` (optional) phải là ObjectId hợp lệ của PT đang active, đã được admin duyệt skill.
    - PT mới phải có skill khớp với category lớp (ưu tiên category mới nếu payload cập nhật).
- `PATCH /api/admin/classes/{classId}/open` - Mở lớp để nhận đăng ký (JWT admin required)
- `PATCH /api/admin/classes/{classId}/close` - Đóng lớp học (JWT admin required)
  - Body: `{ reason: "completed" | "cancelled" }`
- `DELETE /api/admin/classes/{classId}` - Xóa lớp học (JWT admin required)
- `GET /api/admin/classes/{classId}/qrcode` - Lấy QR code check-in (JWT admin required)
  - Response: `{ data: { classId, className, qrCode: { url, cloudinary_id } } }`

### Class Enrollment Endpoints (Customer):
- `GET /api/customer/classes/search` - Tìm kiếm lớp học có sẵn (JWT customer required)
  - Query: `?category=yoga&location=Hanoi&search=yoga&startDate=2025-10-25T00:00:00Z&endDate=2025-10-31T23:59:59Z&page=1&limit=10&sortBy=startTime&sortOrder=asc`
  - Response: `{ data: [{ classId, name, category, capacity, currentEnrollment, availableSpots, isFull, startTime, endTime, status, instructor, isEnrolledByUser }], pagination, filters }`
- `POST /api/customer/classes/{classId}/enroll` - Đăng ký lớp học (JWT customer required)
  - Response: `{ data: { enrollmentId, classId, status, enrolledAt } }`
- `GET /api/customer/enrollments` - Danh sách lớp đã đăng ký (JWT customer required)
  - Query: `?status=active&page=1&limit=10`
  - Response: `{ data: [{ enrollmentId, status, enrolledAt, class: { classId, name, category, startTime, endTime, instructor } }], pagination }`
- `GET /api/customer/enrollments/{enrollmentId}` - Chi tiết enrollment (JWT customer required)
  - Response: `{ data: { enrollmentId, status, enrolledAt, cancelledAt, cancellationReason, class } }`
- `PATCH /api/customer/enrollments/{enrollmentId}/cancel` - Hủy đăng ký lớp (JWT customer required)
  - Body: `{ cancellationReason?: string }`
  - Response: `{ data: { enrollmentId, status, cancelledAt } }`

### Video Endpoints:
- `POST /api/videos/upload` - Upload video (multipart/form-data, JWT required)
  - Body: form-data với field `video` (file)
  - Response: `{ video: { _id, title, thumbnail, streamingUrl, duration, views, createdAt } }`
- `GET /api/videos` - Danh sách tất cả video (pagination hỗ trợ)
  - Query: `?page=1&limit=10`
  - Response: `{ videos: [...], total, page, limit }`
- `GET /api/videos/:id` - Chi tiết video (tăng view count)
  - Response: `{ video: { _id, title, thumbnail, streamingUrl, duration, views, createdAt } }`
- `DELETE /api/videos/:id` - Xóa video (JWT required, admin only)
  - Response: `{ message: "Video deleted successfully" }`

## 🐳 Docker Deployment

```bash
docker run -d \
  --name gymxfit-backend \
  -p 3000:3000 \
  -e MONGO_URI="your_mongodb" \
  -e JWT_SECRET="your-secret-key" \
  -e JWT_EXPIRES_IN="12h" \
  -e ESMS_API_KEY="your-api-key" \
  -e ESMS_SECRET_KEY="your-secret" \
  -e ESMS_SANDBOX="false" \
  -e NODE_ENV="production" \
  --restart unless-stopped \
  rehaise/gymxfit:be
```

## 📁 Project Structure

```
src/
├── config/          # MongoDB & Swagger config
├── controllers/     # Business logic (Auth, User, Staff, Class, Enrollment, Video)
├── middlewares/     # JWT authentication & admin middleware
├── models/          # Database schemas (User, OtpLog, Staff, Class, Enrollment, Video)
├── routes/          # API endpoints with Swagger docs
│   ├── auth.js      # Authentication endpoints
│   ├── user.js      # User profile endpoints
│   ├── staffAuth.js # Staff OTP authentication endpoints
│   ├── staffProfile.js # Staff self-service profile endpoints
│   ├── customerPtBooking.js # Customer PT booking endpoints
│   ├── staff.js     # Staff (PT) management endpoints
│   ├── class.js     # Class management endpoints
│   ├── enrollment.js # Class enrollment endpoints
│   └── video.js     # Video endpoints
├── services/        # External services (SMS OTP, Cloudinary)
└── utils/
    ├── logger.js
    └── validation.js

```
- `GET /api/customer/pt/availability` - Xem lịch trống của 1 PT (JWT customer)
- `POST /api/customer/pt/bookings` - Đặt ca 2h (08-20h, nghỉ 12-14h)
- `GET /api/customer/pt/bookings` - Danh sách lịch đã book (lọc upcoming/history/cancelled)
- `DELETE /api/customer/pt/bookings/{bookingId}` - Huỷ booking trước giờ bắt đầu
