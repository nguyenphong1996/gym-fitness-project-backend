# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Allow optionally installing devDependencies (useful for test builds in CI)
ARG INSTALL_DEV=false
# If INSTALL_DEV=true then install devDependencies, otherwise omit them for smaller production image
RUN if [ "$INSTALL_DEV" = "true" ]; then npm ci --include=dev; else npm ci --omit=dev; fi

# Production stage
# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check (robust: handles connection errors and timeouts)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http=require('http');const options={host:'127.0.0.1',port:3000,path:'/health',timeout:2500};const req=http.get(options,res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1)})"

# Start application
CMD ["npm", "start"]
