// controllers/otpController.js
const axios = require('axios');
const OtpLog = require('../models/OtpLog');

const ESMS_SEND_URL = 'https://rest.esms.vn/MainService.svc/json/SendMessageAutoGenCode_V4_get';
const ESMS_CHECK_URL = 'https://rest.esms.vn/MainService.svc/json/CheckCodeGen_V4_get';

const {
  ESMS_API_KEY, ESMS_SECRET_KEY,
  ESMS_BRANDNAME, ESMS_TIME_ALIVE = '5', ESMS_NUM_CHAR = '4',
  RESEND_COOLDOWN_SECONDS = 60, MAX_OTPS_PER_HOUR = 5
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
  if(!digits){
    return '';
  }
  return hasPlus ? `+${digits}` : digits;
}

exports.requestOtp = async (req, res) => {
  try {
    if (ensureEsmsConfigured(res) !== true) return;

    const phoneRaw = req.body.phone;
    if(!phoneRaw) return res.status(400).json({ error: 'phone is required' });
    const phone = normalizePhone(phoneRaw);
    if(!phone) return res.status(400).json({ error: 'phone invalid' });

    // 1h window count
    const since = new Date(Date.now() - 60*60*1000);
    const recentCount = await OtpLog.countDocuments({ phone, createdAt: { $gte: since } });
    if(recentCount >= Number(MAX_OTPS_PER_HOUR)){
      return res.status(429).json({ error: 'Too many OTP requests. Try later.' });
    }

    // cooldown
    const last = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(last){
      const diffSec = (Date.now() - new Date(last.createdAt).getTime())/1000;
      if(diffSec < Number(RESEND_COOLDOWN_SECONDS)){
        return res.status(429).json({ error: `Please wait ${Math.ceil(Number(RESEND_COOLDOWN_SECONDS)-diffSec)}s before resending`});
      }
    }

    // prepare params
    const params = {
      Phone: phone,
      ApiKey: ESMS_API_KEY,
      SecretKey: ESMS_SECRET_KEY,
      TimeAlive: ESMS_TIME_ALIVE,
      NumCharOfCode: ESMS_NUM_CHAR,
      Brandname: ESMS_BRANDNAME,
      Type: 2,
      Message: '{OTP} is your GymXFit code',
      IsNumber: 1
    };

    const url = ESMS_SEND_URL + '?' + new URLSearchParams(params).toString();
    const apiResp = await axios.get(url, { timeout: 10000 });
    const data = apiResp.data;

    // success = CodeResult == "100"
    if(data && (data.CodeResult === '100' || data.CodeResult === 100)){
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + Number(ESMS_TIME_ALIVE)*60*1000);

      const log = await OtpLog.create({
        phone, smsId: data.SMSID, apiResult: data, createdAt, expiresAt,
        ip: req.ip, status: 'sent'
      });

      return res.json({ ok: true, message: 'OTP sent', smsId: data.SMSID, expiresAt });
    } else {
      await OtpLog.create({
        phone,
        apiResult: data,
        createdAt: new Date(),
        status: 'failed',
        ip: req.ip
      });
      return res.status(500).json({ error: 'sms_send_failed', detail: data });
    }

  } catch (err) {
    console.error('requestOtp error', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'internal_error', detail: err.message || err });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    if (ensureEsmsConfigured(res) !== true) return;

    const { phone: phoneRaw, code } = req.body;
    if(!phoneRaw || !code) return res.status(400).json({ error: 'phone and code are required' });
    const phone = normalizePhone(phoneRaw);
    if(!phone) return res.status(400).json({ error: 'phone invalid' });

    const lastLog = await OtpLog.findOne({ phone }).sort({ createdAt: -1 });
    if(!lastLog) return res.status(400).json({ error: 'no_otp_request_found' });

    // check expiry locally
    const now = new Date();
    if (lastLog.expiresAt && now > lastLog.expiresAt) {
      lastLog.status = 'expired';
      await lastLog.save();
      return res.status(400).json({ ok: false, message: 'otp_expired' });
    }

    // attempts guard
    if ((lastLog.attempts || 0) >= 5) {
      return res.status(429).json({ ok: false, message: 'too_many_attempts' });
    }

    // call eSMS to verify
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
      lastLog.status = 'verified';
      await lastLog.save();
      // NO JWT: simply return success. Frontend can now proceed (create account / start session)
      return res.json({ ok: true, message: 'OTP verified' });
    } else {
      // increment attempts
      lastLog.attempts = (lastLog.attempts || 0) + 1;
      await lastLog.save();
      return res.status(400).json({ ok: false, message: 'invalid_code', detail: data });
    }

  } catch (err) {
    console.error('verifyOtp error', err.response?.data || err.message || err);
    return res.status(500).json({ error: 'internal_error', detail: err.message || err });
  }
};
