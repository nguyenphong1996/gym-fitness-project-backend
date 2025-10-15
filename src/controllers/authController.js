// controllers/authController.js
const User = require('../models/User');
const OtpLog = require('../models/OtpLog');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { validatePhone, validateOtp } = require('../utils/validation');
const { 
  logError, 
  logSuccess, 
  logWarning, 
  logInfo, 
  logDebug,
  logAuth,
  logOTP,
  logRateLimit 
} = require('../utils/logger');

const ESMS_SEND_URL = 'https://rest.esms.vn/MainService.svc/json/SendMessageAutoGenCode_V4_get';
const ESMS_CHECK_URL = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';

const {
  ESMS_API_KEY, ESMS_SECRET_KEY,
  ESMS_BRANDNAME, ESMS_TIME_ALIVE = '5', ESMS_NUM_CHAR = '4',
  RESEND_COOLDOWN_SECONDS = 60, MAX_OTPS_PER_HOUR = 10,
  JWT_SECRET, JWT_EXPIRES_IN = '12h'
} = process.env;

/**
 * Generate JWT token
 */
function generateToken(user) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { 
      userId: user._id, 
      phone: user.phone 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Register: Send OTP for new user
 * POST /api/auth/register
 * Body: { phone: "0912345678" }
 */
exports.register = async (req, res) => {
  try {
    logDebug('authController.register', 'Bắt đầu xử lý đăng ký', { body: req.body });
    
    // Validate phone number
    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      logWarning('authController.register', `Số điện thoại không hợp lệ: ${req.body.phone}`);
      return res.status(400).json({ 
        error: phoneValidation.error,
        message: phoneValidation.message 
      });
    }
    
    const phone = phoneValidation.phone;
    logDebug('authController.register', `Số điện thoại đã chuẩn hóa: ${phone}`);

    // Check if user already exists and verified
    const existingUser = await User.findOne({ phone });
    if (existingUser && existingUser.isVerified) {
      logWarning('authController.register', `Số điện thoại đã đăng ký: ${phone}`);
      return res.status(400).json({ 
        error: 'phone_already_registered',
        message: 'Phone number already registered. Please login instead.' 
      });
    }

    // Rate limiting: Max OTPs per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await OtpLog.countDocuments({ 
      phone, 
      type: 'register',
      createdAt: { $gte: oneHourAgo } 
    });
    
    const maxOtps = parseInt(MAX_OTPS_PER_HOUR) || 10;
    if (recentCount >= maxOtps) {
      logRateLimit(phone, '/api/auth/register', maxOtps - recentCount);
      logWarning('authController.register', `Vượt quá giới hạn OTP: ${phone} (${recentCount}/${maxOtps})`);
      return res.status(429).json({ 
        error: 'rate_limit_exceeded',
        message: `Too many OTP requests. Maximum ${maxOtps} requests per hour. Please try again later.` 
      });
    }

    // Cooldown check: Prevent spam
    const cooldown = parseInt(RESEND_COOLDOWN_SECONDS) || 60;
    const cooldownAgo = new Date(Date.now() - cooldown * 1000);
    const recentOtp = await OtpLog.findOne({ 
      phone,
      type: 'register',
      createdAt: { $gte: cooldownAgo } 
    });
    
    if (recentOtp) {
      const waitTime = Math.ceil((cooldown * 1000 - (Date.now() - recentOtp.createdAt.getTime())) / 1000);
      logWarning('authController.register', `Cooldown chưa hết: ${phone} (còn ${waitTime}s)`);
      return res.status(429).json({ 
        error: 'cooldown_active',
        message: `Please wait ${waitTime} seconds before requesting another OTP.` 
      });
    }

    // SANDBOX MODE: Skip eSMS API call in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await OtpLog.create({
        phone,
        type: 'register',
        sessionId: 'SANDBOX-' + Date.now(),
        expiresAt,
        status: 'pending',
        ip: req.ip
      });
      
      // Log OTP với logger mới
      logOTP('Gửi OTP đăng ký (Sandbox)', phone, mockCode, expiresAt);
      
      return res.json({ 
        ok: true, 
        message: 'OTP sent successfully to your phone (sandbox mode)',
        sessionId: 'SANDBOX-' + Date.now(),
        expiresIn: 600,
        dev_otp: mockCode // Only in dev: return OTP for testing
      });
    }

    // Production: Check eSMS configuration
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;
    const brandname = process.env.ESMS_BRANDNAME;

    if (!apiKey || !secretKey || !brandname) {
      logError('authController.register', 'Cấu hình eSMS chưa đầy đủ');
      return res.status(500).json({ 
        error: 'esms_config_missing', 
        message: 'eSMS not configured' 
      });
    }

    logInfo('authController.register', `Gửi OTP qua eSMS API cho: ${phone}`);

    // Send OTP via eSMS API
    const sendUrl = 'https://rest.esms.vn/MainService.svc/json/SendMessageAutoGenCode_V4_get';
    const response = await axios.get(sendUrl, {
      params: {
        ApiKey: apiKey,
        SecretKey: secretKey,
        Phone: phone,
        Content: `Ma xac nhan dang ky tai khoan cua ban`,
        Brandname: brandname,
        SmsType: 8
      },
      timeout: 10000
    });

    const data = response.data;

    if (data.CodeResult !== '100') {
      logError('authController.register', 'eSMS API trả về lỗi', data);
      
      await OtpLog.create({
        phone,
        type: 'register',
        status: 'failed',
        apiResult: data,
        ip: req.ip
      });
      
      return res.status(500).json({ 
        error: 'sms_send_failed',
        message: 'Failed to send OTP. Please try again later.' 
      });
    }

    const sessionId = data.SMSID;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await OtpLog.create({
      phone,
      type: 'register',
      sessionId,
      expiresAt,
      status: 'pending',
      apiResult: data,
      ip: req.ip
    });

    logSuccess('authController.register', `Gửi OTP thành công cho: ${phone}`, { sessionId });

    return res.json({ 
      ok: true, 
      message: 'OTP sent successfully to your phone',
      sessionId,
      expiresIn: 600
    });

  } catch (err) {
    logError('authController.register', 'Lỗi không xác định khi gửi OTP', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to send OTP. Please try again.' 
    });
  }
};

/**
 * Verify Registration OTP and create user
 * POST /api/auth/verify-register
 * Body: { phone: "0912345678", otp: "1234" }
 */
exports.verifyRegister = async (req, res) => {
  try {
    logDebug('authController.verifyRegister', 'Bắt đầu xác thực OTP đăng ký', { body: req.body });
    
    // Validate phone
    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      logWarning('authController.verifyRegister', `Số điện thoại không hợp lệ: ${req.body.phone}`);
      return res.status(400).json({ 
        error: phoneValidation.error,
        message: phoneValidation.message 
      });
    }
    
    // Validate OTP
    const otpValidation = validateOtp(req.body.code);
    if (!otpValidation.valid) {
      logWarning('authController.verifyRegister', `Mã OTP không hợp lệ: ${req.body.code}`);
      return res.status(400).json({ 
        error: otpValidation.error,
        message: otpValidation.message 
      });
    }
    
    const phone = phoneValidation.phone;
    const code = otpValidation.otp; // validateOtp returns 'otp' field

    // Find latest pending OTP
    const lastLog = await OtpLog.findOne({ 
      phone,
      type: 'register',
      status: 'pending' 
    }).sort({ createdAt: -1 });
    
    if (!lastLog) {
      logWarning('authController.verifyRegister', `Không tìm thấy OTP request cho: ${phone}`);
      return res.status(400).json({ 
        error: 'no_otp_request',
        message: 'No OTP request found. Please request OTP first.' 
      });
    }

    // Check expiration
    if (new Date() > lastLog.expiresAt) {
      lastLog.status = 'expired';
      await lastLog.save();
      logWarning('authController.verifyRegister', `OTP đã hết hạn cho: ${phone}`);
      return res.status(400).json({ 
        error: 'otp_expired',
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    // Check max attempts
    if ((lastLog.attempts || 0) >= 5) {
      lastLog.status = 'failed';
      await lastLog.save();
      logWarning('authController.verifyRegister', `Vượt quá số lần thử cho: ${phone} (${lastLog.attempts} lần)`);
      return res.status(400).json({ 
        error: 'max_attempts_exceeded',
        message: 'Maximum verification attempts exceeded. Please request a new OTP.' 
      });
    }

    // SANDBOX MODE: Accept any 4-digit code in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      logInfo('authController.verifyRegister', `Xác thực OTP (Sandbox mode) cho: ${phone}`);
      
      // Mark OTP as verified
      lastLog.status = 'verified';
      await lastLog.save();

      // Create or update user
      let user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({ phone, isVerified: true });
        logSuccess('authController.verifyRegister', `Tạo user mới (Sandbox): ${phone}`, { userId: user._id });
      } else {
        user.isVerified = true;
        await user.save();
        logSuccess('authController.verifyRegister', `Cập nhật user (Sandbox): ${phone}`, { userId: user._id });
      }

      // Generate JWT token
      const token = generateToken(user);
      logAuth('Đăng ký thành công (Sandbox)', phone, true);

      return res.json({ 
        ok: true, 
        message: 'Registration successful (sandbox mode)',
        token,
        user: {
          id: user._id,
          phone: user.phone,
          isVerified: user.isVerified,
          createdAt: user.createdAt
        }
      });
    }

    // Production: Verify with eSMS API
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      logError('authController.verifyRegister', 'Cấu hình eSMS chưa đầy đủ');
      return res.status(500).json({ 
        error: 'esms_config_missing', 
        message: 'eSMS not configured' 
      });
    }

    logInfo('authController.verifyRegister', `Xác thực OTP qua eSMS API cho: ${phone}`);

    const checkUrl = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';
    const verifyResponse = await axios.get(checkUrl, {
      params: {
        ApiKey: apiKey,
        SecretKey: secretKey,
        Phone: phone,
        Code: code,
        SMSID: lastLog.sessionId
      },
      timeout: 10000
    });

    // Increment attempts
    lastLog.attempts = (lastLog.attempts || 0) + 1;

    if (verifyResponse.data.CodeResult !== '100') {
      await lastLog.save();
      logAuth('Xác thực OTP đăng ký thất bại', phone, false, 'Mã OTP không đúng');
      logWarning('authController.verifyRegister', `OTP không đúng cho: ${phone} (lần thử ${lastLog.attempts}/5)`);
      return res.status(400).json({ 
        error: 'invalid_otp',
        message: 'Invalid OTP code. Please try again.' 
      });
    }

    // OTP verified successfully
    lastLog.status = 'verified';
    await lastLog.save();

    // Create or update user
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone, isVerified: true });
      logSuccess('authController.verifyRegister', `Tạo user mới: ${phone}`, { userId: user._id });
    } else {
      user.isVerified = true;
      await user.save();
      logSuccess('authController.verifyRegister', `Cập nhật user: ${phone}`, { userId: user._id });
    }

    // Generate JWT token
    const token = generateToken(user);
    logAuth('Đăng ký thành công', phone, true);

    return res.json({ 
      ok: true, 
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    });

  } catch (err) {
    logError('authController.verifyRegister', 'Lỗi không xác định khi xác thực OTP đăng ký', err);
    return res.status(500).json({ 
      error: 'server_error',
      message: 'Failed to verify OTP. Please try again.' 
    });
  }
};

/**
 * Login: Send OTP for existing verified user
 * POST /api/auth/login
 * Body: { phone: "0912345678" }
 */
exports.login = async (req, res) => {
  try {
    logDebug('authController.login', 'Bắt đầu xử lý đăng nhập', { body: req.body });

    // Validate phone
    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      logWarning('authController.login', `Phone không hợp lệ: ${req.body.phone}`);
      return res.status(400).json({ 
        error: phoneValidation.error,
        message: phoneValidation.message 
      });
    }
    
    const phone = phoneValidation.phone;
    logDebug('authController.login', `Số điện thoại đã chuẩn hóa: ${phone}`);

    // Check if user exists and verified
    const existingUser = await User.findOne({ phone });
    if(!existingUser) {
      logWarning('authController.login', `Số điện thoại chưa đăng ký: ${phone}`);
      return res.status(404).json({ 
        error: 'user_not_found', 
        message: 'Phone not registered. Please sign up first.' 
      });
    }
    if(!existingUser.isVerified) {
      logWarning('authController.login', `Tài khoản chưa xác thực: ${phone}`);
      return res.status(403).json({ 
        error: 'user_not_verified', 
        message: 'Account not verified. Please complete registration.' 
      });
    }

    // Rate limiting
    const since = new Date(Date.now() - 60*60*1000);
    const recentCount = await OtpLog.countDocuments({ phone, createdAt: { $gte: since } });
    if(recentCount >= Number(MAX_OTPS_PER_HOUR)){
      logRateLimit(phone, 'login', 0);
      return res.status(429).json({ 
        error: 'rate_limit_exceeded', 
        message: 'Too many OTP requests. Try later.' 
      });
    }

    // Log remaining attempts
    const remaining = Number(MAX_OTPS_PER_HOUR) - recentCount;
    if (remaining <= 3) {
      logRateLimit(phone, 'login', remaining);
    }

    // Cooldown check
    const last = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(last){
      const diffSec = (Date.now() - new Date(last.createdAt).getTime())/1000;
      if(diffSec < Number(RESEND_COOLDOWN_SECONDS)){
        const waitTime = Math.ceil(Number(RESEND_COOLDOWN_SECONDS)-diffSec);
        logWarning('authController.login', `Cooldown: ${phone} phải đợi ${waitTime}s`);
        return res.status(429).json({ 
          error: 'cooldown_active', 
          message: `Please wait ${waitTime}s before resending`
        });
      }
    }

    // SANDBOX MODE: Skip eSMS API call in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + Number(ESMS_TIME_ALIVE)*60*1000);
      
      logOTP('Gửi OTP đăng nhập (Sandbox)', phone, mockCode, expiresAt);
      
      await OtpLog.create({
        phone, 
        smsId: 'SANDBOX-LOGIN-' + Date.now(), 
        apiResult: { CodeResult: '100', SMSID: 'SANDBOX-LOGIN', Message: 'Sandbox mode login' }, 
        createdAt, 
        expiresAt, 
        ip: req.ip, 
        status: 'sent'
      });
      
      return res.json({ 
        ok: true, 
        message: 'OTP sent for login (sandbox mode)', 
        smsId: 'SANDBOX-LOGIN-' + Date.now(), 
        expiresAt,
        dev_otp: mockCode // Only in dev: return OTP for testing
      });
    }

    // Production: check eSMS config
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      logError('authController.login', 'Cấu hình eSMS chưa đầy đủ');
      return res.status(500).json({ 
        error: 'esms_config_missing', 
        message: 'eSMS not configured' 
      });
    }

    logInfo('authController.login', `Gọi eSMS API để gửi OTP đăng nhập cho: ${phone}`);

    // Send OTP via eSMS - Template đã được phê duyệt cho Baotrixemay (LOGIN)
    const params = {
      Phone: phone,
      ApiKey: apiKey,
      SecretKey: secretKey,
      TimeAlive: ESMS_TIME_ALIVE,
      NumCharOfCode: ESMS_NUM_CHAR,
      Brandname: ESMS_BRANDNAME,
      Type: 2,
      Message: '{OTP} la ma xac minh dang ky Baotrixemay cua ban',
      IsNumber: 1
    };

    const url = ESMS_SEND_URL + '?' + new URLSearchParams(params).toString();
    const apiResp = await axios.get(url, { timeout: 10000 });
    const data = apiResp.data;

    if(data && (data.CodeResult === '100' || data.CodeResult === 100)){
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + Number(ESMS_TIME_ALIVE)*60*1000);

      await OtpLog.create({
        phone, smsId: data.SMSID, apiResult: data, createdAt, expiresAt,
        ip: req.ip, status: 'sent'
      });

      logSuccess('authController.login', `Gửi OTP đăng nhập thành công cho: ${phone}`, { smsId: data.SMSID });

      return res.json({ ok: true, message: 'OTP sent for login', smsId: data.SMSID, expiresAt });
    } else {
      await OtpLog.create({
        phone, apiResult: data, createdAt: new Date(), status: 'failed', ip: req.ip
      });
      logError('authController.login', `eSMS API trả về lỗi cho: ${phone}`, data);
      return res.status(500).json({ 
        error: 'sms_send_failed', 
        message: 'Failed to send OTP',
        detail: data 
      });
    }

  } catch (err) {
    logError('authController.login', 'Lỗi không xác định khi gửi OTP đăng nhập', err);
    return res.status(500).json({ 
      error: 'login_error', 
      message: 'Failed to send login OTP'
    });
  }
};

// Verify login OTP
exports.verifyLogin = async (req, res) => {
  try {
    logDebug('authController.verifyLogin', 'Bắt đầu xác thực OTP đăng nhập', { body: req.body });

    // Validate phone
    const phoneValidation = validatePhone(req.body.phone);
    if (!phoneValidation.valid) {
      logWarning('authController.verifyLogin', `Phone không hợp lệ: ${req.body.phone}`);
      return res.status(400).json({ 
        error: phoneValidation.error,
        message: phoneValidation.message 
      });
    }

    // Validate OTP
    const otpValidation = validateOtp(req.body.code);
    if (!otpValidation.valid) {
      logWarning('authController.verifyLogin', `OTP không hợp lệ: ${req.body.code}`);
      return res.status(400).json({ 
        error: otpValidation.error,
        message: otpValidation.message 
      });
    }

    const phone = phoneValidation.phone;
    const otp = otpValidation.otp;

    // Check user exists
    const user = await User.findOne({ phone });
    if(!user || !user.isVerified) {
      logWarning('authController.verifyLogin', `User không tồn tại hoặc chưa xác thực: ${phone}`);
      return res.status(404).json({ 
        error: 'user_not_found', 
        message: 'User not found or not verified' 
      });
    }

    // Find last OTP log
    const lastLog = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(!lastLog) {
      logWarning('authController.verifyLogin', `Không tìm thấy OTP request cho: ${phone}`);
      return res.status(400).json({ 
        error: 'no_otp_request_found',
        message: 'No OTP request found' 
      });
    }

    // Check expiry
    const now = new Date();
    if (lastLog.expiresAt && now > lastLog.expiresAt) {
      lastLog.status = 'expired';
      await lastLog.save();
      logWarning('authController.verifyLogin', `OTP đã hết hạn cho: ${phone}`);
      return res.status(400).json({ 
        error: 'otp_expired',
        message: 'OTP expired' 
      });
    }

    // Attempts guard
    if ((lastLog.attempts || 0) >= 5) {
      logWarning('authController.verifyLogin', `Quá số lần thử OTP cho: ${phone}`);
      return res.status(429).json({ 
        error: 'too_many_attempts',
        message: 'Too many attempts' 
      });
    }

    // SANDBOX MODE: Accept any 4-digit code in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      logInfo('authController.verifyLogin', `Xác thực OTP đăng nhập (Sandbox) cho: ${phone}`);
      
      // Accept any 4-digit code in sandbox
      lastLog.status = 'verified';
      await lastLog.save();

      // Generate JWT token
      const token = generateToken(user);

      logSuccess('authController.verifyLogin', `Đăng nhập thành công (Sandbox): ${phone}`);
      logAuth('Đăng nhập thành công (Sandbox)', phone, true);

      return res.json({ 
        ok: true, 
        message: 'Login successful (sandbox mode)', 
        token,
        user: { 
          id: user._id,
          phone: user.phone, 
          createdAt: user.createdAt 
        } 
      });
    }

    // Production: verify with eSMS
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      logError('authController.verifyLogin', 'Cấu hình eSMS chưa đầy đủ');
      return res.status(500).json({ 
        error: 'esms_config_missing', 
        message: 'eSMS not configured' 
      });
    }

    logInfo('authController.verifyLogin', `Xác thực OTP đăng nhập qua eSMS cho: ${phone}`);

    // Verify OTP via eSMS
    const checkUrl = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';
    const apiResp = await axios.get(checkUrl, {
      params: {
        ApiKey: apiKey,
        SecretKey: secretKey,
        Phone: phone,
        Code: otp,
        SMSID: lastLog.sessionId
      },
      timeout: 10000
    });
    const data = apiResp.data;

    if(data && (data.CodeResult === '100' || data.CodeResult === 100)) {
      // OTP valid - login success
      lastLog.status = 'verified';
      await lastLog.save();

      // Generate JWT token
      const token = generateToken(user);

      logSuccess('authController.verifyLogin', `Đăng nhập thành công: ${phone}`);
      logAuth('Đăng nhập thành công', phone, true);

      return res.json({ 
        ok: true, 
        message: 'Login successful', 
        token,
        user: { 
          id: user._id,
          phone: user.phone, 
          createdAt: user.createdAt 
        } 
      });
    } else {
      // Invalid code
      lastLog.attempts = (lastLog.attempts || 0) + 1;
      await lastLog.save();
      
      logAuth('Đăng nhập thất bại', phone, false, `OTP không đúng (lần thử ${lastLog.attempts}/5)`);
      logWarning('authController.verifyLogin', `OTP không đúng cho: ${phone} (lần thử ${lastLog.attempts}/5)`);
      
      return res.status(400).json({ 
        error: 'invalid_otp',
        message: 'Invalid OTP code',
        detail: data 
      });
    }

  } catch (err) {
    logError('authController.verifyLogin', 'Lỗi không xác định khi xác thực OTP đăng nhập', err);
    return res.status(500).json({ 
      error: 'verify_login_error', 
      message: 'Failed to verify login OTP'
    });
  }
};