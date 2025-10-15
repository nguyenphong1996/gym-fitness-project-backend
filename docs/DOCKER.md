# 🐳 Docker Guide

## Quick Start

### Build và chạy local

```bash
# Build Docker image
docker build -t gym-fitness-backend .

# Chạy container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name gym-fitness-backend \
  gym-fitness-backend

# Xem logs
docker logs -f gym-fitness-backend

# Health check
curl http://localhost:3000/health
```

---

## Pull từ GitHub Container Registry

### Bước 1: Login vào ghcr.io

```bash
# Tạo Personal Access Token (PAT) tại:
# GitHub → Settings → Developer settings → Personal access tokens → Generate new token
# Chọn quyền: read:packages

# Login
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u nguyenphong1996 --password-stdin
```

### Bước 2: Pull image

```bash
# Pull latest (từ main branch)
docker pull ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest

# Pull develop branch
docker pull ghcr.io/nguyenphong1996/gym-fitness-project-backend:develop

# Pull specific commit
docker pull ghcr.io/nguyenphong1996/gym-fitness-project-backend:main-abc1234
```

### Bước 3: Chạy container

```bash
docker run -d \
  -p 3000:3000 \
  -e MONGO_URI="your_mongodb_uri" \
  -e JWT_SECRET="your_jwt_secret" \
  -e ESMS_API_KEY="your_esms_key" \
  -e ESMS_SECRET_KEY="your_esms_secret" \
  -e ESMS_BRANDNAME="Baotrixemay" \
  --name gym-backend \
  ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest
```

---

## Docker Compose (Recommended)

Tạo file `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGO_URI=${MONGO_URI}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=7d
      - ESMS_API_KEY=${ESMS_API_KEY}
      - ESMS_SECRET_KEY=${ESMS_SECRET_KEY}
      - ESMS_BRANDNAME=Baotrixemay
      - ESMS_SANDBOX=false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

Chạy với docker-compose:

```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Environment Variables

### Required
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key cho JWT
- `ESMS_API_KEY` - eSMS API key
- `ESMS_SECRET_KEY` - eSMS secret key

### Optional
- `JWT_EXPIRES_IN` - Default: `7d`
- `ESMS_BRANDNAME` - Default: `Baotrixemay`
- `ESMS_SANDBOX` - Default: `false` (set `true` cho testing)
- `MAX_OTPS_PER_HOUR` - Default: `10`
- `RESEND_COOLDOWN_SECONDS` - Default: `60`

---

## Useful Commands

```bash
# Xem running containers
docker ps

# Stop container
docker stop gym-fitness-backend

# Remove container
docker rm gym-fitness-backend

# Xem logs
docker logs gym-fitness-backend

# Exec vào container
docker exec -it gym-fitness-backend sh

# Remove image
docker rmi ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune -a
```

---

## Troubleshooting

### Container không start
```bash
# Check logs
docker logs gym-fitness-backend

# Check health
docker inspect --format='{{.State.Health.Status}}' gym-fitness-backend
```

### Port already in use
```bash
# Tìm process đang dùng port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### MongoDB connection failed
- Check `MONGO_URI` trong environment variables
- Ensure MongoDB Atlas IP whitelist includes Docker host IP

---

## Production Deployment

### VPS Deployment với Docker

```bash
# SSH vào VPS
ssh user@your-vps-ip

# Install Docker (nếu chưa có)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Login GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u nguyenphong1996 --password-stdin

# Pull latest image
docker pull ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest

# Run với production config
docker run -d \
  -p 3000:3000 \
  --restart=unless-stopped \
  --env-file /path/to/.env \
  --name gym-backend \
  ghcr.io/nguyenphong1996/gym-fitness-project-backend:latest

# Setup auto-update (optional)
# Watchtower sẽ tự động pull image mới và restart container
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  gym-backend \
  --interval 300
```

---

## Image Tags

| Tag | Description | Trigger |
|-----|-------------|---------|
| `latest` | Production (main branch) | Push to `main` |
| `develop` | Development | Push to `develop` |
| `main-<sha>` | Specific commit on main | Push to `main` |
| `develop-<sha>` | Specific commit on develop | Push to `develop` |

---

## CI/CD Integration

Docker image được tự động build và push khi:
- ✅ Tests pass
- ✅ Build thành công
- ✅ Push vào `main` hoặc `develop` branch

Chi tiết xem: [CI-CD.md](./CI-CD.md)
