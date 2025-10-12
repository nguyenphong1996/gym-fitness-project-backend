# 📚 API Documentation với Swagger

## 🌐 Truy cập API Documentation

Sau khi start server, truy cập:

```
http://localhost:3000/api-docs
```

Hoặc production:
```
https://api.gymfitness.com/api-docs
```

---

## 🔑 Cách sử dụng API Documentation

### 1️⃣ **Xem danh sách endpoints**
- Swagger UI hiển thị tất cả API endpoints
- Chia theo tags: Authentication, User
- Click vào từng endpoint để xem chi tiết

### 2️⃣ **Test API trực tiếp trên Swagger**

#### Endpoints không cần authentication:
```bash
# POST /api/auth/register
# POST /api/auth/verify-register
# POST /api/auth/login
# POST /api/auth/verify-login
```

**Cách test:**
1. Click vào endpoint
2. Click nút **"Try it out"**
3. Điền request body (JSON)
4. Click **"Execute"**
5. Xem response

#### Endpoints cần authentication (JWT Token):
```bash
# GET /api/user/profile
# PUT /api/user/profile
```

**Cách test:**
1. Đăng ký hoặc đăng nhập để lấy JWT token
2. Click nút **"Authorize"** 🔒 ở góc trên bên phải
3. Nhập token theo format: `Bearer <your-token>`
4. Click **"Authorize"**
5. Bây giờ có thể test các protected endpoints

---

## 📝 Ví dụ Test Flow

### Flow 1: Đăng ký tài khoản mới

**Bước 1: Gửi OTP**
```http
POST /api/auth/register
Content-Type: application/json

{
  "phone": "0912345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP đã được gửi đến số điện thoại 0912345678",
  "smsId": "abc123",
  "dev_otp": "123456"  // Chỉ có trong sandbox mode
}
```

**Bước 2: Xác thực OTP**
```http
POST /api/auth/verify-register
Content-Type: application/json

{
  "phone": "0912345678",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "phone": "0912345678",
    "isVerified": true,
    "createdAt": "2025-10-12T10:30:00.000Z"
  }
}
```

**Bước 3: Lưu token và sử dụng cho protected routes**
```http
GET /api/user/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Flow 2: Đăng nhập

**Bước 1: Gửi OTP**
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "0912345678"
}
```

**Bước 2: Xác thực OTP**
```http
POST /api/auth/verify-login
Content-Type: application/json

{
  "phone": "0912345678",
  "otp": "123456"
}
```

**Response:** Giống như verify-register, trả về token và user info

---

## 🎨 Export API cho Frontend

### Export OpenAPI Spec

Swagger UI cho phép export API specification dưới dạng:
- **JSON**: http://localhost:3000/api-docs.json
- **YAML**: http://localhost:3000/api-docs.yaml

### Sử dụng trong Frontend

#### 1. **React/Next.js - Axios**

```javascript
// api/auth.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export const authAPI = {
  // Đăng ký - gửi OTP
  register: (phone) => 
    axios.post(`${API_BASE_URL}/api/auth/register`, { phone }),

  // Xác thực OTP đăng ký
  verifyRegister: (phone, otp) => 
    axios.post(`${API_BASE_URL}/api/auth/verify-register`, { phone, otp }),

  // Đăng nhập - gửi OTP
  login: (phone) => 
    axios.post(`${API_BASE_URL}/api/auth/login`, { phone }),

  // Xác thực OTP đăng nhập
  verifyLogin: (phone, otp) => 
    axios.post(`${API_BASE_URL}/api/auth/verify-login`, { phone, otp })
};

export const userAPI = {
  // Lấy profile (cần token)
  getProfile: (token) => 
    axios.get(`${API_BASE_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Cập nhật profile
  updateProfile: (token, data) => 
    axios.put(`${API_BASE_URL}/api/user/profile`, data, {
      headers: { Authorization: `Bearer ${token}` }
    })
};
```

#### 2. **Generate Client tự động**

Sử dụng OpenAPI Generator để tự động generate API client:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript Axios client
openapi-generator-cli generate \
  -i http://localhost:3000/api-docs.json \
  -g typescript-axios \
  -o ./generated/api
```

---

## 🔧 Cấu hình Swagger

File cấu hình: `src/config/swagger.js`

### Thay đổi thông tin API:
```javascript
info: {
  title: 'Gym Fitness API',
  version: '1.0.0',
  description: 'API documentation...',
  contact: {
    name: 'API Support',
    email: 'support@gymfitness.com'
  }
}
```

### Thêm server URL:
```javascript
servers: [
  {
    url: 'http://localhost:3000',
    description: 'Development server'
  },
  {
    url: 'https://api.gymfitness.com',
    description: 'Production server'
  }
]
```

---

## 📖 Thêm documentation cho endpoint mới

Khi thêm endpoint mới, thêm JSDoc comment:

```javascript
/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Mô tả ngắn gọn
 *     tags: [TagName]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fieldName:
 *                 type: string
 *                 example: "value"
 *     responses:
 *       200:
 *         description: Success response
 */
router.post('/your-endpoint', controller.method);
```

---

## 🚀 Tips cho Frontend Developer

### 1. **Luôn kiểm tra Swagger trước khi code**
- Xem request body format
- Xem response structure
- Test API trước khi tích hợp

### 2. **Sử dụng Try it out**
- Test trực tiếp trên Swagger
- Không cần Postman
- Copy request/response examples

### 3. **Export Postman Collection**
Swagger có thể export sang Postman collection:
- Click "Export" → "Postman Collection"
- Import vào Postman để test

### 4. **Xử lý JWT Token**
```javascript
// Lưu token sau khi login
localStorage.setItem('token', response.data.token);

// Sử dụng token cho các request sau
axios.defaults.headers.common['Authorization'] = 
  `Bearer ${localStorage.getItem('token')}`;
```

---

## 🐛 Troubleshooting

### Swagger UI không hiển thị
```bash
# Check server đang chạy
lsof -i :3000

# Restart server
npm start

# Truy cập lại
http://localhost:3000/api-docs
```

### Thay đổi code không update
- Restart server để swagger-jsdoc đọc lại comments
- Clear browser cache
- Hard reload (Ctrl + Shift + R)

---

## 📞 Support

Nếu có thắc mắc về API:
- Xem Swagger UI: http://localhost:3000/api-docs
- Đọc docs: `docs/API-GUIDE.md`
- Check source code: `src/routes/*.js`
