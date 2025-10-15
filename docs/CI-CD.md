# CI/CD Pipeline Documentation

## 🚀 Continuous Integration (CI)

### Pipeline Overview

Mỗi khi push code hoặc tạo Pull Request, GitHub Actions sẽ tự động chạy:

```
┌─────────────┐
│   Push Code │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Run Tests  │ ← Test trên Node 18.x & 20.x
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Build    │ ← Kiểm tra build thành công
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Code Quality │ ← Check lint, format, security
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Build Docker │ ← Build & push image (chỉ main/develop)
│   Image     │   → ghcr.io/nguyenphong1996/gym-fitness-project-backend
└─────────────┘
```

---

## 📋 CI Jobs

### 1️⃣ **Test & Lint**
- Chạy trên Node.js 18.x và 20.x
- Install dependencies với `npm ci`
- Chạy linter (nếu có)
- Chạy unit tests (nếu có)
- Check security vulnerabilities với `npm audit`

### 2️⃣ **Build Application**
- Install dependencies
- Build application (nếu có build script)
- Test server khởi động thành công trên port 3000

### 3️⃣ **Code Quality Check**
- Check code formatting
- Tìm TODO/FIXME comments
- Code quality metrics

### 4️⃣ **Build & Push Docker Image** 🐳
- **Chỉ chạy khi push vào `main` hoặc `develop`**
- Build Docker image với multi-stage build
- Push lên GitHub Container Registry (ghcr.io)
- Tags:
  - `latest` (cho main branch)
  - `develop` (cho develop branch)
  - `main-<commit-sha>` hoặc `develop-<commit-sha>`

**Docker Image URL:**
```
ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest
ghcr.io/nguyenphong1996/gym-fitness-project-backend:develop
ghcr.io/nguyenphong1996/gym-fitness-project-backend:main-abc1234
```

---

## 🐳 Docker Setup

### Dockerfile
Project có multi-stage Dockerfile để:
- **Build stage**: Install dependencies
- **Production stage**: Tối ưu size image với Alpine Linux
- **Security**: Chạy với non-root user
- **Health check**: Endpoint `/health` để check container healthy

### Chạy Docker local
```bash
# Build image
docker build -t gym-fitness-backend:local .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name gym-fitness-backend \
  gym-fitness-backend:local

# Check logs
docker logs -f gym-fitness-backend

# Stop container
docker stop gym-fitness-backend
docker rm gym-fitness-backend
```

### Pull image từ GitHub Container Registry
```bash
# Login (cần Personal Access Token với quyền read:packages)
echo $GITHUB_TOKEN | docker login ghcr.io -u nguyenphong1996 --password-stdin

# Pull image
docker pull ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest

# Run
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest
```

---

## ⚙️ Configuration

### Branches được CI check:
- `main` - Production branch
- `develop` - Development branch
- `feature/**` - Feature branches

### Pull Requests:
- Tự động chạy CI khi tạo PR vào `main` hoặc `develop`

---

## 🔧 Setup Instructions

### 1. Đẩy code lên GitHub
```bash
git add .
git commit -m "feat: Add CI/CD pipeline with GitHub Actions"
git push origin feature/ci-cd-pipeline
```

### 2. Tạo Pull Request
- Vào GitHub repository
- Tạo PR từ `feature/ci-cd-pipeline` → `develop` hoặc `main`
- CI sẽ tự động chạy

### 3. Xem kết quả
- Vào tab **Actions** trên GitHub
- Xem chi tiết từng job
- Check pass/fail status

---

## 📊 Status Badges

Sau khi CI chạy, bạn có thể thêm badge vào README chính:

```markdown
![CI Status](https://github.com/nguyenphong1996/gym-fitness-project-backend/workflows/CI%20Pipeline/badge.svg)
```

---

## 🎯 Next Steps (CD - Continuous Deployment)

Khi cần deploy lên VPS, sẽ thêm:

### **CD Pipeline (Future)**
```yaml
deploy-staging:
  - Deploy to staging server
  - Run smoke tests
  - Notify team

deploy-production:
  - Require manual approval
  - Deploy to production
  - Health check
  - Rollback if failed
```

### **Cần chuẩn bị:**
- 🖥️ VPS IP address & SSH key
- 🐳 Docker setup (optional)
- 🔐 Environment variables secrets
- 📧 Notification channels (Slack, Email)

---

## 🐛 Troubleshooting

### CI fails on "Check application starts"
- Đảm bảo port 3000 không bị chiếm
- Check MongoDB connection không bắt buộc trong CI

### npm audit warnings
- Update packages: `npm update`
- Fix critical vulnerabilities: `npm audit fix`

### Tests failing
- Chạy local trước: `npm test`
- Check environment variables

---

## 📝 Notes

- ✅ CI check code quality và build Docker image
- ✅ **Docker image chỉ được build khi push vào `main` hoặc `develop`**
- ✅ Feature branches chỉ chạy test + build, **không** build Docker
- ✅ CI chạy **miễn phí** trên GitHub Actions (2000 minutes/month)
- ✅ Docker images được lưu tại **GitHub Container Registry (ghcr.io)**
- ⚠️ MongoDB connection trong CI sẽ skip (vì không có MONGO_URI trong CI)
- 🐳 Docker image size: ~150MB (với Alpine Linux)

---

## 🤝 Contributing

Khi develop:
1. Tạo branch mới: `git checkout -b feature/your-feature`
2. Code & commit
3. Push: `git push origin feature/your-feature`
4. Tạo Pull Request
5. **Đợi CI pass** ✅ trước khi merge
