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

- ✅ CI hiện tại **chỉ check code quality**, không deploy
- ✅ **Không cần VPS** để CI chạy
- ✅ CI chạy **miễn phí** trên GitHub Actions (2000 minutes/month)
- ⚠️ MongoDB connection trong CI sẽ skip (vì không có MONGO_URI trong CI)

---

## 🤝 Contributing

Khi develop:
1. Tạo branch mới: `git checkout -b feature/your-feature`
2. Code & commit
3. Push: `git push origin feature/your-feature`
4. Tạo Pull Request
5. **Đợi CI pass** ✅ trước khi merge
