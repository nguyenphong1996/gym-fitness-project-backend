# Gym Fitness Project Backend

Backend API - Xác thực OTP qua SMS & Quản lý User Profile

## 📚 API Documentation

**Production:** https://be.phongnguyen.software/api-docs

### Authentication Endpoints:
- `POST /api/auth/send-otp` - Gửi mã OTP qua SMS
- `POST /api/auth/verify-otp` - Xác thực mã OTP
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập

### User Profile Endpoints:
- `GET /api/user/profile` - Lấy thông tin profile (JWT required)
- `PUT /api/user/profile` - Cập nhật profile: name, email, avatarUrl, dob, weight, height (JWT required)

---

## 🐳 Docker Deployment

```bash
docker run -d \
  --name gymxfit-backend \
  -p 3000:3000 \
  -e MONGO_URI="mongodb+srv://user:pass@cluster.mongodb.net/gymfitness" \
  -e JWT_SECRET="your-secret-key" \
  -e JWT_EXPIRES_IN="12h" \
  -e ESMS_API_KEY="your-api-key" \
  -e ESMS_SECRET_KEY="your-secret" \
  -e ESMS_SANDBOX="false" \
  --restart unless-stopped \
  rehaise/gymxfit:be
```

## 📁 Project Structure

```
src/
├── config/          # MongoDB & Swagger config
├── controllers/     # Auth & User logic
├── middlewares/     # JWT authentication
├── models/          # User & OtpLog schemas
├── routes/          # API endpoints
└── services/        # SMS OTP service
```
