# Gym Fitness Project Backend

Backend API - Xác thực OTP qua SMS, Quản lý User Profile & Delete Account

## 📚 API Documentation

**Swagger UI:** http://localhost:3000/api-docs  
**Production:** https://be.phongnguyen.software/api-docs

### Authentication Endpoints:
- `POST /api/auth/register` - Gửi OTP đăng ký
- `POST /api/auth/verify-register` - Xác thực OTP & tạo tài khoản
- `POST /api/auth/login` - Gửi OTP đăng nhập
- `POST /api/auth/verify-login` - Xác thực OTP & đăng nhập

### User Profile Endpoints:
- `GET /api/user/profile` - Lấy thông tin profile (JWT required)
- `PUT /api/user/profile` - Cập nhật profile: name, email, avatarUrl, gender, dob, weight, height (JWT required)

### Delete Account Endpoints:
- `POST /api/user/account/delete/request` - Gửi OTP xác nhận xóa tài khoản (JWT required)
- `DELETE /api/user/account/delete/confirm` - Xác nhận OTP & xóa vĩnh viễn tài khoản (JWT required)

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
├── controllers/     # Auth & User logic (with Vietnamese logging)
├── middlewares/     # JWT authentication
├── models/          # User & OtpLog schemas
├── routes/          # API endpoints (with Swagger docs)
├── services/        # SMS OTP service
└── utils/
    ├── logger.js   
    └── validation.js 

```
