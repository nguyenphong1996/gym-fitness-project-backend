
// services/otpService.js
const axios = require('axios');
const OtpLog = require('../models/OtpLog');
const { logError, logSuccess, logWarning, logInfo, logOTP, logRateLimit } = require('../utils/logger');

const {
  ESMS_API_KEY, ESMS_SECRET_KEY, ESMS_BRANDNAME,
  NODE_ENV, ESMS_SANDBOX,
  RESEND_COOLDOWN_SECONDS = 60,
  MAX_OTPS_PER_HOUR = 10,
  OTP_EXPIRATION_MINUTES = 10,
  MAX_VERIFY_ATTEMPTS = 5
} = process.env;

// Allow overriding SmsType via env (eSMS doc specifies SmsType=2 for OTP)
const ESMS_SMS_TYPE = process.env.ESMS_SMS_TYPE || '2';

const ESMS_SEND_URL = 'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/';
const ESMS_CHECK_URL = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';

// Custom Error for OTP service
class OtpServiceError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OtpServiceError';
    this.statusCode = details.statusCode || 400;
    this.code = details.code || 'otp_error';
  }
}

/**
 * Checks if eSMS is configured. Throws an error if not.
 */
function ensureEsmsConfigured() {
  if (NODE_ENV !== 'development' && ESMS_SANDBOX !== 'true') {
    if (!ESMS_API_KEY || !ESMS_SECRET_KEY || !ESMS_BRANDNAME) {
      logError('otpService', 'Cấu hình eSMS (API_KEY, SECRET_KEY, BRANDNAME) chưa đầy đủ cho production.');
      throw new OtpServiceError('eSMS service is not configured on the server.', {
        statusCode: 500,
        code: 'esms_config_missing'
      });
    }
  }
}

/**
 * Gets the appropriate content for the OTP message based on the type.
 * @param {string} type - The type of OTP ('register', 'login', 'delete_account').
 * @returns {string} The message content.
 * NOTE: eSMS test API template (fixed): "XXXX la ma xac minh dang ky Baotrixemay cua ban"
 * - Only XXXX can be changed (the OTP code)
 * - Must use non-accented Vietnamese
 * - Must use "dang ky" (register) for test API
 */
function getOtpContent(type, otp, brandName) {
  // eSMS test API requires exact template - cannot modify content or brandname
  // Template: "XXXX la ma xac minh dang ky Baotrixemay cua ban"
  return `${otp} la ma xac minh dang ky Baotrixemay cua ban`;
}

/**
 * Requests an OTP for a given phone number and type.
 * Handles rate limiting, cooldowns, and sandbox mode.
 * @param {string} phone - The user's phone number.
 * @param {string} type - The purpose of the OTP ('register', 'login', 'delete_account').
 * @param {string} ip - The user's IP address for logging.
 * @returns {object} Result of the OTP request.
 */
exports.requestOtp = async (phone, type, ip) => {
  ensureEsmsConfigured();

  // 1. Rate Limiting Check
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await OtpLog.countDocuments({ phone, type, createdAt: { $gte: oneHourAgo } });
  const maxOtps = parseInt(MAX_OTPS_PER_HOUR);

  if (recentCount >= maxOtps) {
    logRateLimit(phone, `requestOtp:${type}`, maxOtps - recentCount);
    throw new OtpServiceError(`Too many OTP requests. Maximum ${maxOtps} requests per hour.`, {
      statusCode: 429,
      code: 'rate_limit_exceeded'
    });
  }

  // 2. Cooldown Check
  const cooldown = parseInt(RESEND_COOLDOWN_SECONDS);
  const cooldownAgo = new Date(Date.now() - cooldown * 1000);
  const recentOtp = await OtpLog.findOne({ phone, type, createdAt: { $gte: cooldownAgo } });

  if (recentOtp) {
    const waitTime = Math.ceil((cooldown * 1000 - (Date.now() - recentOtp.createdAt.getTime())) / 1000);
    throw new OtpServiceError(`Please wait ${waitTime} seconds before requesting another OTP.`, {
      statusCode: 429,
      code: 'cooldown_active'
    });
  }

  const expiresAt = new Date(Date.now() + parseInt(OTP_EXPIRATION_MINUTES) * 60 * 1000);

  // 3. Sandbox Mode
  if (NODE_ENV === 'development' || ESMS_SANDBOX === 'true') {
    const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionId = `sandbox-${type}-${Date.now()}`;
    
    await OtpLog.create({ phone, type, code: mockCode, sessionId, expiresAt, status: 'pending', ip });
    logOTP(`Gửi OTP ${type} (Sandbox)`, phone, mockCode, expiresAt);
    
    return {
      ok: true,
      message: `OTP sent successfully to your phone (sandbox mode)`,
      sessionId,
      expiresIn: parseInt(OTP_EXPIRATION_MINUTES) * 60,
      dev_otp: mockCode
    };
  }

  // 4. Production: Send real OTP via eSMS
  logInfo('otpService.requestOtp', `Gửi OTP ${type} qua eSMS API cho: ${phone}`);
  
  // eSMS API requires JSON body with specific template format
  // Note: Content must match registered template or will get error 146
  // Format: "CODE la ma xac minh dang ky/dang nhap Brandname cua ban"
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // Generate 4-digit OTP
  const content = getOtpContent(type, otp, ESMS_BRANDNAME);

  const payload = {
    ApiKey: ESMS_API_KEY,
    SecretKey: ESMS_SECRET_KEY,
    Phone: phone,
    Content: content,
    Brandname: ESMS_BRANDNAME,
    SmsType: ESMS_SMS_TYPE,
    IsUnicode: '0'
  };

  try {
    logInfo('otpService.requestOtp', `Gửi OTP ${type} qua eSMS API cho: ${phone}`, payload);
    
    const response = await axios.post(ESMS_SEND_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const data = response.data;

    if (data.CodeResult !== '100') {
      logError('otpService.requestOtp', `eSMS API trả về lỗi khi gửi OTP ${type}`, data);
      await OtpLog.create({ phone, type, code: otp, status: 'failed', apiResult: data, ip });
      throw new OtpServiceError('Failed to send OTP. Please try again later.', {
        statusCode: 500,
        code: 'sms_send_failed'
      });
    }

    const sessionId = data.SMSID;
    await OtpLog.create({ phone, type, code: otp, sessionId, expiresAt, status: 'pending', apiResult: data, ip });
    logSuccess('otpService.requestOtp', `Gửi OTP ${type} thành công cho: ${phone}`, { sessionId });

    return {
      ok: true,
      message: 'OTP sent successfully to your phone',
      sessionId,
      expiresIn: parseInt(OTP_EXPIRATION_MINUTES) * 60
    };
  } catch (error) {
    logError('otpService.requestOtp', `Lỗi nghiêm trọng khi gọi eSMS API cho OTP ${type}`, error);
    await OtpLog.create({ phone, type, status: 'failed', apiResult: { error: error.message }, ip });
    throw new OtpServiceError('Failed to send OTP due to a network or configuration error.', {
      statusCode: 500,
      code: 'sms_api_call_failed'
    });
  }
};

/**
 * Verifies an OTP for a given phone number and type.
 * Handles expiration, max attempts, and sandbox mode.
 * @param {string} phone - The user's phone number.
 * @param {string} otp - The OTP code from the user.
 * @param {string} type - The purpose of the OTP ('register', 'login', 'delete_account').
 * @returns {Promise<boolean>} True if verification is successful.
 */
exports.verifyOtp = async (phone, otp, type) => {
  ensureEsmsConfigured();

  // 1. Find the latest pending OTP log
  const lastLog = await OtpLog.findOne({ phone, type, status: 'pending' }).sort({ createdAt: -1 });

  if (!lastLog) {
    throw new OtpServiceError('No OTP request found. Please request OTP first.', { code: 'no_otp_request' });
  }

  // 2. Check expiration
  if (new Date() > lastLog.expiresAt) {
    lastLog.status = 'expired';
    await lastLog.save();
    throw new OtpServiceError('OTP has expired. Please request a new one.', { code: 'otp_expired' });
  }

  // 3. Check max attempts
  const maxAttempts = parseInt(MAX_VERIFY_ATTEMPTS);
  if ((lastLog.attempts || 0) >= maxAttempts) {
    lastLog.status = 'failed';
    await lastLog.save();
    throw new OtpServiceError('Maximum verification attempts exceeded.', {
      statusCode: 429,
      code: 'max_attempts_exceeded'
    });
  }

  // 4. Sandbox Mode
  if (NODE_ENV === 'development' || ESMS_SANDBOX === 'true') {
    logInfo('otpService.verifyOtp', `Xác thực OTP ${type} (Sandbox) cho: ${phone}`);
    // In sandbox, any 4-digit code is accepted for simplicity.
    // A specific dev_otp could also be checked here if needed.
    if (/^\d{4}$/.test(otp)) {
      lastLog.status = 'verified';
      await lastLog.save();
      return true;
    } else {
      lastLog.attempts = (lastLog.attempts || 0) + 1;
      await lastLog.save();
      throw new OtpServiceError('Invalid OTP code.', { code: 'invalid_otp' });
    }
  }

  // 5. Production: Verify OTP from database
  logInfo('otpService.verifyOtp', `Xác thực OTP ${type} qua eSMS API cho: ${phone}`);
  lastLog.attempts = (lastLog.attempts || 0) + 1;

  // Compare OTP code from database
  if (lastLog.code !== otp) {
    await lastLog.save();
    logWarning('otpService.verifyOtp', `OTP ${type} không đúng cho: ${phone} (lần thử ${lastLog.attempts}/${maxAttempts})`);
    throw new OtpServiceError('Invalid OTP code.', { code: 'invalid_otp' });
  }

  // 6. Success
  lastLog.status = 'verified';
  await lastLog.save();
  logSuccess('otpService.verifyOtp', `Xác thực OTP ${type} thành công cho: ${phone}`);
  return true;
};

exports.OtpServiceError = OtpServiceError;
