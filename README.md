# Gym Fitness Project Backend

Backend API cho ứng dụng Gym Fitness với tính năng xác thực người dùng và OTP.

## Cài đặt và chạy local

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ template:
```bash
cp .env.example .env
```

3. Cấu hình các biến môi trường trong file `.env`:
- `MONGO_URI`: Kết nối MongoDB Atlas
- `ESMS_API_KEY` và `ESMS_SECRET_KEY`: API keys cho dịch vụ SMS ESMS
- `JWT_SECRET`: Secret key cho JWT tokens

4. Chạy server development:
```bash
npm run dev
```

Server sẽ chạy tại `http://localhost:3000`

## Deployment lên VPS

### 1. Chuẩn bị VPS
- Cài đặt Node.js và npm
- Cài đặt PM2 (process manager): `npm install -g pm2`

### 2. Upload code
```bash
# Trên local machine
git clone <repository-url>
cd gym-fitness-project-backend

# Upload lên VPS (thay your-vps-ip)
scp -r . user@your-vps-ip:/path/to/your/app/
```

### 3. Cấu hình trên VPS
```bash
# SSH vào VPS
ssh user@your-vps-ip

# Chuyển đến thư mục app
cd /path/to/your/app/

# Cài đặt dependencies
npm install --production

# Tạo file .env với giá trị thật
cp .env.example .env
nano .env  # Điền các giá trị thật
```

### 4. Chạy production
```bash
# Chạy với PM2
pm2 start bin/www --name "gym-fitness-backend"

# Hoặc chạy trực tiếp
npm start
```

### 5. Test API
API sẽ có sẵn tại: `http://127.0.0.1:3000`

Endpoints chính:
- `POST /api/auth/send-otp` - Gửi OTP
- `POST /api/auth/verify-otp` - Xác thực OTP
- `POST /api/auth/register` - Đăng ký người dùng
- `POST /api/auth/login` - Đăng nhập

### 6. Cấu hình Firewall (tùy chọn)
```bash
# Mở port 3000
sudo ufw allow 3000
```

## API Documentation

Swagger documentation: `http://localhost:3000/api-docs`

## Cấu trúc project

```
src/
├── config/          # Cấu hình database và swagger
├── controllers/     # Logic xử lý request
├── middlewares/     # Middleware xác thực
├── models/          # Schema MongoDB
├── routes/          # API routes
├── services/        # Business logic
└── utils/           # Utilities
```
