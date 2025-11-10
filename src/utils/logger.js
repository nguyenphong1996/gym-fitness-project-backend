// utils/logger.js
// Centralized logging utility với tiếng Việt

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Format timestamp
 */
function timestamp() {
  return new Date().toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Log error với format chuẩn (Tiếng Việt)
 */
exports.logError = (context, message, error = null) => {
  console.error(`\n${colors.red}❌ [LỖI] ${timestamp()}${colors.reset}`);
  console.error(`${colors.bright}📍 Vị trí:${colors.reset} ${context}`);
  console.error(`${colors.bright}💬 Thông báo:${colors.reset} ${message}`);
  
  if (error) {
    if (error.response?.data) {
      // Axios error with response
      console.error(`${colors.bright}📡 API Response:${colors.reset}`, JSON.stringify(error.response.data, null, 2));
      console.error(`${colors.bright}📊 Status Code:${colors.reset} ${error.response.status}`);
    } else if (error.message) {
      // Standard error
      console.error(`${colors.bright}📝 Chi tiết lỗi:${colors.reset} ${error.message}`);
    } else if (typeof error === 'string') {
      console.error(`${colors.bright}📝 Chi tiết lỗi:${colors.reset} ${error}`);
    } else {
      console.error(`${colors.bright}📝 Chi tiết lỗi:${colors.reset}`, error);
    }
    
    // Stack trace nếu có
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.error(`${colors.bright}🔍 Stack Trace:${colors.reset}`);
      console.error(colors.red + error.stack + colors.reset);
    }
  }
  
  console.error(''); // Empty line
};

/**
 * Log success (Tiếng Việt)
 */
exports.logSuccess = (context, message, data = null) => {
  console.log(`\n${colors.green}✅ [THÀNH CÔNG] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}📍 Vị trí:${colors.reset} ${context}`);
  console.log(`${colors.bright}💬 Thông báo:${colors.reset} ${message}`);
  
  if (data) {
    console.log(`${colors.bright}📦 Dữ liệu:${colors.reset}`, data);
  }
  
  console.log(''); // Empty line
};

/**
 * Log warning (Tiếng Việt)
 */
exports.logWarning = (context, message, data = null) => {
  console.warn(`\n${colors.yellow}⚠️  [CẢNH BÁO] ${timestamp()}${colors.reset}`);
  console.warn(`${colors.bright}📍 Vị trí:${colors.reset} ${context}`);
  console.warn(`${colors.bright}💬 Thông báo:${colors.reset} ${message}`);
  
  if (data) {
    console.warn(`${colors.bright}📦 Dữ liệu:${colors.reset}`, data);
  }
  
  console.warn(''); // Empty line
};

/**
 * Log info (Tiếng Việt)
 */
exports.logInfo = (context, message, data = null) => {
  console.log(`\n${colors.cyan}ℹ️  [THÔNG TIN] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}📍 Vị trí:${colors.reset} ${context}`);
  console.log(`${colors.bright}💬 Thông báo:${colors.reset} ${message}`);
  
  if (data) {
    console.log(`${colors.bright}📦 Dữ liệu:${colors.reset}`, data);
  }
  
  console.log(''); // Empty line
};

/**
 * Log debug (Tiếng Việt) - chỉ hiện trong development
 */
exports.logDebug = (context, message, data = null) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.log(`\n${colors.magenta}🔧 [DEBUG] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}📍 Vị trí:${colors.reset} ${context}`);
  console.log(`${colors.bright}💬 Thông báo:${colors.reset} ${message}`);
  
  if (data) {
    console.log(`${colors.bright}📦 Dữ liệu:${colors.reset}`, JSON.stringify(data, null, 2));
  }
  
  console.log(''); // Empty line
};

/**
 * Log database operation (Tiếng Việt)
 */
exports.logDatabase = (operation, collection, data = null) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.log(`\n${colors.blue}💾 [DATABASE] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}🔄 Thao tác:${colors.reset} ${operation}`);
  console.log(`${colors.bright}📁 Collection:${colors.reset} ${collection}`);
  
  if (data) {
    console.log(`${colors.bright}📦 Dữ liệu:${colors.reset}`, data);
  }
  
  console.log(''); // Empty line
};

/**
 * Log API request (Tiếng Việt)
 */
exports.logRequest = (method, endpoint, data = null) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  console.log(`\n${colors.cyan}📨 [REQUEST] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}🔗 Endpoint:${colors.reset} ${method} ${endpoint}`);
  
  if (data) {
    console.log(`${colors.bright}📦 Body:${colors.reset}`, JSON.stringify(data, null, 2));
  }
  
  console.log(''); // Empty line
};

/**
 * Log validation error (Tiếng Việt)
 */
exports.logValidationError = (field, value, reason) => {
  console.error(`\n${colors.yellow}⚠️  [VALIDATION ERROR] ${timestamp()}${colors.reset}`);
  console.error(`${colors.bright}🏷️  Trường:${colors.reset} ${field}`);
  console.error(`${colors.bright}📝 Giá trị:${colors.reset} ${value}`);
  console.error(`${colors.bright}❌ Lý do:${colors.reset} ${reason}`);
  console.error(''); // Empty line
};

/**
 * Log authentication event (Tiếng Việt)
 */
exports.logAuth = (event, phone, success = true, reason = null) => {
  const icon = success ? '✅' : '❌';
  const color = success ? colors.green : colors.red;
  const status = success ? 'THÀNH CÔNG' : 'THẤT BẠI';
  
  console.log(`\n${color}${icon} [AUTH - ${status}] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}🔐 Sự kiện:${colors.reset} ${event}`);
  console.log(`${colors.bright}📱 Số điện thoại:${colors.reset} ${phone}`);
  
  if (!success && reason) {
    console.log(`${colors.bright}❌ Lý do:${colors.reset} ${reason}`);
  }
  
  console.log(''); // Empty line
};

/**
 * Log OTP event (Tiếng Việt)
 */
exports.logOTP = (action, phone, otpCode = null, expiresAt = null) => {
  console.log(`\n${colors.blue}🔐 [OTP] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}🔄 Hành động:${colors.reset} ${action}`);
  console.log(`${colors.bright}📱 Số điện thoại:${colors.reset} ${phone}`);
  
  if (otpCode) {
    console.log(`${colors.bright}🔢 Mã OTP:${colors.reset} ${otpCode}`);
  }
  
  if (expiresAt) {
    console.log(`${colors.bright}⏰ Hết hạn lúc:${colors.reset} ${expiresAt.toLocaleString('vi-VN')}`);
  }
  
  console.log(''); // Empty line
};

/**
 * Log rate limit event (Tiếng Việt)
 */
exports.logRateLimit = (phone, endpoint, remaining) => {
  console.warn(`\n${colors.yellow}⏱️  [RATE LIMIT] ${timestamp()}${colors.reset}`);
  console.warn(`${colors.bright}📱 Số điện thoại:${colors.reset} ${phone}`);
  console.warn(`${colors.bright}🔗 Endpoint:${colors.reset} ${endpoint}`);
  console.warn(`${colors.bright}📊 Còn lại:${colors.reset} ${remaining} requests`);
  console.warn(''); // Empty line
};

/**
 * Log user action (Tiếng Việt)
 */
exports.logUserAction = (userId, action, details = null) => {
  console.log(`\n${colors.cyan}👤 [USER ACTION] ${timestamp()}${colors.reset}`);
  console.log(`${colors.bright}🆔 User ID:${colors.reset} ${userId}`);
  console.log(`${colors.bright}🔄 Hành động:${colors.reset} ${action}`);
  
  if (details) {
    console.log(`${colors.bright}📝 Chi tiết:${colors.reset}`, details);
  }
  
  console.log(''); // Empty line
};

/**
 * Log video upload status (Tiếng Việt)
 */
exports.logVideoUpload = (status, data = {}) => {
  const statusEmoji = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌'
  };
  
  const statusColor = {
    pending: colors.yellow,
    processing: colors.cyan,
    completed: colors.green,
    failed: colors.red
  };
  
  const icon = statusEmoji[status] || '📹';
  const color = statusColor[status] || colors.cyan;
  
  console.log(`\n${color}${icon} [VIDEO UPLOAD - ${status.toUpperCase()}] ${timestamp()}${colors.reset}`);
  
  if (data.fileName) {
    console.log(`${colors.bright}📄 Tên file:${colors.reset} ${data.fileName}`);
  }
  
  if (data.fileSize) {
    const sizeMB = (data.fileSize / (1024 * 1024)).toFixed(2);
    console.log(`${colors.bright}📊 Kích thước:${colors.reset} ${sizeMB} MB`);
  }
  
  if (data.title) {
    console.log(`${colors.bright}🎬 Tiêu đề:${colors.reset} ${data.title}`);
  }
  
  if (data.duration) {
    const mins = Math.floor(data.duration / 60);
    const secs = data.duration % 60;
    console.log(`${colors.bright}⏱️  Thời lượng:${colors.reset} ${mins}m ${secs}s`);
  }
  
  if (data.category) {
    console.log(`${colors.bright}🏷️  Loại video:${colors.reset} ${data.category}`);
  }
  
  if (data.cloudinary_id) {
    console.log(`${colors.bright}☁️  Cloudinary ID:${colors.reset} ${data.cloudinary_id}`);
  }
  
  if (data.url) {
    console.log(`${colors.bright}🔗 URL:${colors.reset} ${data.url}`);
  }
  
  if (data.error) {
    console.log(`${colors.bright}❌ Lỗi:${colors.reset} ${data.error}`);
  }
  
  if (data.views !== undefined) {
    console.log(`${colors.bright}👁️  Lượt xem:${colors.reset} ${data.views}`);
  }
  
  console.log(''); // Empty line
};

/**
 * Log avatar upload status (Tiếng Việt)
 */
exports.logAvatarUpload = (status, data = {}) => {
  const statusEmoji = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌'
  };
  
  const statusColor = {
    pending: colors.yellow,
    processing: colors.cyan,
    completed: colors.green,
    failed: colors.red
  };
  
  const icon = statusEmoji[status] || '🖼️';
  const color = statusColor[status] || colors.cyan;
  
  console.log(`\n${color}${icon} [AVATAR UPLOAD - ${status.toUpperCase()}] ${timestamp()}${colors.reset}`);
  
  if (data.phone) {
    console.log(`${colors.bright}📱 Số điện thoại:${colors.reset} ${data.phone}`);
  }
  
  if (data.fileName) {
    console.log(`${colors.bright}📄 Tên file:${colors.reset} ${data.fileName}`);
  }
  
  if (data.fileSize) {
    const sizeKB = (data.fileSize / 1024).toFixed(2);
    console.log(`${colors.bright}📊 Kích thước:${colors.reset} ${sizeKB} KB`);
  }
  
  if (data.oldCloudinaryId) {
    console.log(`${colors.bright}🗑️  Avatar cũ (xóa):${colors.reset} ${data.oldCloudinaryId}`);
  }
  
  if (data.cloudinary_id) {
    console.log(`${colors.bright}☁️  Cloudinary ID:${colors.reset} ${data.cloudinary_id}`);
  }
  
  if (data.url) {
    console.log(`${colors.bright}🔗 URL:${colors.reset} ${data.url}`);
  }
  
  if (data.error) {
    console.log(`${colors.bright}❌ Lỗi:${colors.reset} ${data.error}`);
  }
  
  console.log(''); // Empty line
};
