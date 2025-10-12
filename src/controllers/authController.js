// controllers/authController.js
const User = require('../models/User');
const OtpLog = require('../models/OtpLog');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const ESMS_SEND_URL = 'https://rest.esms.vn/MainService.svc/json/SendMessageAutoGenCode_V4_get';
const ESMS_CHECK_URL = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';

const {
  ESMS_API_KEY, ESMS_SECRET_KEY,
  ESMS_BRANDNAME, ESMS_TIME_ALIVE = '5', ESMS_NUM_CHAR = '4',
  RESEND_COOLDOWN_SECONDS = 60, MAX_OTPS_PER_HOUR = 5,
  JWT_SECRET, JWT_EXPIRES_IN = '7d'
} = process.env;

function ensureEsmsConfigured(res) {
  if (!ESMS_API_KEY || !ESMS_SECRET_KEY || !ESMS_BRANDNAME) {
    return res.status(500).json({ error: 'esms_config_missing' });
  }
  return true;
}

function normalizePhone(phone){
  if(!phone) return phone;
  const raw = phone.toString().trim();
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g,'');
  if(!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

// Generate JWT token for user
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

// Register: send OTP for new user
exports.register = async (req, res) => {
  try {
    const phoneRaw = req.body.phone;
    if(!phoneRaw) return res.status(400).json({ error: 'phone is required' });
    const phone = normalizePhone(phoneRaw);
    if(!phone) return res.status(400).json({ error: 'phone invalid' });

    // Check if user already exists and verified
    const existingUser = await User.findOne({ phone });
    if(existingUser && existingUser.isVerified) {
      return res.status(400).json({ error: 'Phone already registered. Please sign in.' });
    }

    // Rate limiting: 1h window count
    const since = new Date(Date.now() - 60*60*1000);
    const recentCount = await OtpLog.countDocuments({ phone, createdAt: { $gte: since } });
    if(recentCount >= Number(MAX_OTPS_PER_HOUR)){
      return res.status(429).json({ error: 'Too many OTP requests. Try later.' });
    }

    // Cooldown check
    const last = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(last){
      const diffSec = (Date.now() - new Date(last.createdAt).getTime())/1000;
      if(diffSec < Number(RESEND_COOLDOWN_SECONDS)){
        return res.status(429).json({ error: `Please wait ${Math.ceil(Number(RESEND_COOLDOWN_SECONDS)-diffSec)}s before resending`});
      }
    }

    // SANDBOX MODE: Skip eSMS API call in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + Number(ESMS_TIME_ALIVE)*60*1000);
      
      await OtpLog.create({
        phone, 
        smsId: 'SANDBOX-' + Date.now(), 
        apiResult: { CodeResult: '100', SMSID: 'SANDBOX', Message: 'Sandbox mode' }, 
        createdAt, 
        expiresAt, 
        ip: req.ip, 
        status: 'sent'
      });
      
      return res.json({ 
        ok: true, 
        message: 'OTP sent (sandbox mode)', 
        smsId: 'SANDBOX-' + Date.now(), 
        expiresAt,
        dev_otp: mockCode // Only in dev: return OTP for testing
      });
    }

    // Production: check eSMS config
    if (ensureEsmsConfigured(res) !== true) return;

    // Send OTP via eSMS - Template đã được phê duyệt cho Baotrixemay (REGISTER)
    const params = {
      Phone: phone,
      ApiKey: ESMS_API_KEY,
      SecretKey: ESMS_SECRET_KEY,
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

      return res.json({ ok: true, message: 'OTP sent', smsId: data.SMSID, expiresAt });
    } else {
      await OtpLog.create({
        phone, apiResult: data, createdAt: new Date(), status: 'failed', ip: req.ip
      });
      return res.status(500).json({ error: 'sms_send_failed', detail: data });
    }

  } catch (err) {
    console.error('register error', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'internal_error', detail: err.message || err });
  }
};

// Verify registration OTP and create user
exports.verifyRegister = async (req, res) => {
  try {
    const { phone: phoneRaw, code } = req.body;
    if(!phoneRaw || !code) return res.status(400).json({ error: 'phone and code are required' });
    const phone = normalizePhone(phoneRaw);
    if(!phone) return res.status(400).json({ error: 'phone invalid' });

    // Find last OTP log
    const lastLog = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(!lastLog) return res.status(400).json({ error: 'no_otp_request_found' });

    // Check expiry
    const now = new Date();
    if (lastLog.expiresAt && now > lastLog.expiresAt) {
      lastLog.status = 'expired';
      await lastLog.save();
      return res.status(400).json({ ok: false, message: 'otp_expired' });
    }

    // Attempts guard
    if ((lastLog.attempts || 0) >= 5) {
      return res.status(429).json({ ok: false, message: 'too_many_attempts' });
    }

    // SANDBOX MODE: Accept any 4-digit code in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      if (!/^\d{4}$/.test(code)) {
        lastLog.attempts = (lastLog.attempts || 0) + 1;
        await lastLog.save();
        return res.status(400).json({ ok: false, message: 'invalid_code_format' });
      }

      // Accept any 4-digit code in sandbox
      lastLog.status = 'verified';
      await lastLog.save();

      let user = await User.findOne({ phone });
      if(!user) {
        user = await User.create({ phone, isVerified: true });
      } else {
        user.isVerified = true;
        await user.save();
      }

      // Generate JWT token
      const token = generateToken(user);

      return res.json({ 
        ok: true, 
        message: 'Registration successful (sandbox mode)', 
        token,
        user: { 
          id: user._id,
          phone: user.phone, 
          createdAt: user.createdAt 
        } 
      });
    }

    // Production: verify with eSMS
    if (ensureEsmsConfigured(res) !== true) return;

    // Verify OTP via eSMS
    const params = {
      ApiKey: ESMS_API_KEY,
      SecretKey: ESMS_SECRET_KEY,
      Phone: phone,
      Code: code
    };
    const url = ESMS_CHECK_URL + '?' + new URLSearchParams(params).toString();
    const apiResp = await axios.get(url, { timeout: 10000 });
    const data = apiResp.data;

    if(data && (data.CodeResult === '100' || data.CodeResult === 100)) {
      // OTP valid - create or update user
      lastLog.status = 'verified';
      await lastLog.save();

      let user = await User.findOne({ phone });
      if(!user) {
        user = await User.create({ phone, isVerified: true });
      } else {
        user.isVerified = true;
        await user.save();
      }

      // Generate JWT token
      const token = generateToken(user);

      return res.json({ 
        ok: true, 
        message: 'Registration successful', 
        token,
        user: { 
          id: user._id,
          phone: user.phone, 
          createdAt: user.createdAt 
        } 
      });
    } else {
      // Invalid code - increment attempts
      lastLog.attempts = (lastLog.attempts || 0) + 1;
      await lastLog.save();
      return res.status(400).json({ ok: false, message: 'invalid_code', detail: data });
    }

  } catch (err) {
    console.error('verifyRegister error', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'internal_error', detail: err.message || err });
  }
};

// Login: send OTP for existing verified user
exports.login = async (req, res) => {
  try {
    const phoneRaw = req.body.phone;
    if(!phoneRaw) return res.status(400).json({ error: 'phone is required' });
    const phone = normalizePhone(phoneRaw);
    if(!phone) return res.status(400).json({ error: 'phone invalid' });

    // Check if user exists and verified
    const existingUser = await User.findOne({ phone });
    if(!existingUser) {
      return res.status(404).json({ error: 'Phone not registered. Please sign up first.' });
    }
    if(!existingUser.isVerified) {
      return res.status(403).json({ error: 'Account not verified. Please complete registration.' });
    }

    // Rate limiting
    const since = new Date(Date.now() - 60*60*1000);
    const recentCount = await OtpLog.countDocuments({ phone, createdAt: { $gte: since } });
    if(recentCount >= Number(MAX_OTPS_PER_HOUR)){
      return res.status(429).json({ error: 'Too many OTP requests. Try later.' });
    }

    // Cooldown check
    const last = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(last){
      const diffSec = (Date.now() - new Date(last.createdAt).getTime())/1000;
      if(diffSec < Number(RESEND_COOLDOWN_SECONDS)){
        return res.status(429).json({ error: `Please wait ${Math.ceil(Number(RESEND_COOLDOWN_SECONDS)-diffSec)}s before resending`});
      }
    }

    // SANDBOX MODE: Skip eSMS API call in development
    if (process.env.NODE_ENV === 'development' || process.env.ESMS_SANDBOX === 'true') {
      const mockCode = Math.floor(1000 + Math.random() * 9000).toString();
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + Number(ESMS_TIME_ALIVE)*60*1000);
      
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
    if (ensureEsmsConfigured(res) !== true) return;

    // Send OTP via eSMS - Template đã được phê duyệt cho Baotrixemay (LOGIN)
    const params = {
      Phone: phone,
      ApiKey: ESMS_API_KEY,
      SecretKey: ESMS_SECRET_KEY,
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

      return res.json({ ok: true, message: 'OTP sent for login', smsId: data.SMSID, expiresAt });
    } else {
      await OtpLog.create({
        phone, apiResult: data, createdAt: new Date(), status: 'failed', ip: req.ip
      });
      return res.status(500).json({ error: 'sms_send_failed', detail: data });
    }

  } catch (err) {
    console.error('login error', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'internal_error', detail: err.message || err });
  }
};

// Verify login OTP
exports.verifyLogin = async (req, res) => {
  try {
    if (ensureEsmsConfigured(res) !== true) return;

    const { phone: phoneRaw, code } = req.body;
    if(!phoneRaw || !code) return res.status(400).json({ error: 'phone and code are required' });
    const phone = normalizePhone(phoneRaw);
    if(!phone) return res.status(400).json({ error: 'phone invalid' });

    // Check user exists
    const user = await User.findOne({ phone });
    if(!user || !user.isVerified) {
      return res.status(404).json({ error: 'User not found or not verified' });
    }

    // Find last OTP log
    const lastLog = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(!lastLog) return res.status(400).json({ error: 'no_otp_request_found' });

    // Check expiry
    const now = new Date();
    if (lastLog.expiresAt && now > lastLog.expiresAt) {
      lastLog.status = 'expired';
      await lastLog.save();
      return res.status(400).json({ ok: false, message: 'otp_expired' });
    }

    // Attempts guard
    if ((lastLog.attempts || 0) >= 5) {
      return res.status(429).json({ ok: false, message: 'too_many_attempts' });
    }

    // Verify OTP via eSMS
    const params = {
      ApiKey: ESMS_API_KEY,
      SecretKey: ESMS_SECRET_KEY,
      Phone: phone,
      Code: code
    };
    const url = ESMS_CHECK_URL + '?' + new URLSearchParams(params).toString();
    const apiResp = await axios.get(url, { timeout: 10000 });
    const data = apiResp.data;

    if(data && (data.CodeResult === '100' || data.CodeResult === 100)) {
      // OTP valid - login success
      lastLog.status = 'verified';
      await lastLog.save();

      // Generate JWT token
      const token = generateToken(user);

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
      return res.status(400).json({ ok: false, message: 'invalid_code', detail: data });
    }

  } catch (err) {
    console.error('verifyLogin error', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'internal_error', detail: err.message || err });
  }
};