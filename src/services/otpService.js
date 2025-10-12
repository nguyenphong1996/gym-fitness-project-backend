const https = require('https');
const http = require('http');
const { URL } = require('url');

class OtpServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'OtpServiceError';
    this.statusCode = options.statusCode || 500;
    this.details = options.details;
  }
}

const BASE_URL = process.env.ESMS_BASE_URL || 'https://rest.esms.vn/MainService.svc/json';
const API_KEY = process.env.ESMS_API_KEY;
const SECRET_KEY = process.env.ESMS_SECRET_KEY;
const BRAND_NAME = process.env.ESMS_BRAND_NAME;
const OTP_TYPE = process.env.ESMS_OTP_TYPE ? Number(process.env.ESMS_OTP_TYPE) : undefined;
const CONTENT_TEMPLATE = process.env.ESMS_OTP_CONTENT || 'Ma xac thuc OTP cua ban la {OTP}.';

function buildUrl(pathname) {
  const trimmedBase = BASE_URL.replace(/\/$/, '');
  const trimmedPath = pathname.replace(/^\//, '');
  return `${trimmedBase}/${trimmedPath}`;
}

function postJson(pathname, payload) {
  const url = new URL(buildUrl(pathname));
  const data = JSON.stringify(payload);

  const options = {
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname + url.search,
    port: url.port || undefined,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const transport = url.protocol === 'http:' ? http : https;

  return new Promise((resolve, reject) => {
    const request = transport.request(options, (response) => {
      let responseBody = '';

      response.on('data', (chunk) => {
        responseBody += chunk;
      });

      response.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new OtpServiceError('ESMS tra ve loi', {
              statusCode: response.statusCode || 502,
              details: parsed
            }));
          }
        } catch (err) {
          reject(new OtpServiceError('Khong the phan tich du lieu tu ESMS', {
            statusCode: 502,
            details: { raw: responseBody }
          }));
        }
      });
    });

    request.on('error', (error) => {
      reject(new OtpServiceError('Khong the ket noi den dich vu ESMS', {
        statusCode: 502,
        details: { error: error.message }
      }));
    });

    request.write(data);
    request.end();
  });
}

function ensureCredentials() {
  if (!API_KEY || !SECRET_KEY) {
    throw new OtpServiceError('Thieu cau hinh ESMS_API_KEY hoac ESMS_SECRET_KEY', { statusCode: 500 });
  }
}

function parseCodeResult(response) {
  const code = Number(response.CodeResult);
  return {
    codeResult: Number.isNaN(code) ? response.CodeResult : code,
    errorMessage: response.ErrorMessage,
    sessionId: response.SessionId || response.SessionID,
    smsId: response.SMSID || response.SMSId,
    raw: response
  };
}

async function sendOtp(phoneNumber, options = {}) {
  ensureCredentials();

  if (!phoneNumber) {
    throw new OtpServiceError('So dien thoai la bat buoc', { statusCode: 400 });
  }

  const payload = {
    ApiKey: API_KEY,
    SecretKey: SECRET_KEY,
    Phone: phoneNumber,
    Content: options.content || CONTENT_TEMPLATE
  };

  const brandName = options.brandName || BRAND_NAME;
  if (brandName) {
    payload.BrandName = brandName;
  }

  const otpTypeValue = options.otpType !== undefined ? Number(options.otpType) : OTP_TYPE;
  if (otpTypeValue !== undefined && otpTypeValue !== null && !Number.isNaN(otpTypeValue)) {
    payload.OTPType = otpTypeValue;
  }

  const response = await postJson('SendOTP', payload);
  const parsed = parseCodeResult(response);

  if (parsed.codeResult !== 100) {
    throw new OtpServiceError(parsed.errorMessage || 'Khong the gui OTP', {
      statusCode: 502,
      details: parsed.raw
    });
  }

  return {
    message: 'Gui OTP thanh cong',
    sessionId: parsed.sessionId,
    smsId: parsed.smsId,
    response: parsed.raw
  };
}

async function verifyOtp({ sessionId, code, phone }) {
  ensureCredentials();

  if (!sessionId) {
    throw new OtpServiceError('SessionId la bat buoc', { statusCode: 400 });
  }

  if (!code) {
    throw new OtpServiceError('Ma OTP la bat buoc', { statusCode: 400 });
  }

  const payload = {
    ApiKey: API_KEY,
    SecretKey: SECRET_KEY,
    SessionId: sessionId,
    Code: code
  };

  if (phone) {
    payload.Phone = phone;
  }

  const response = await postJson('CheckOTP', payload);
  const parsed = parseCodeResult(response);

  if (parsed.codeResult !== 100) {
    throw new OtpServiceError(parsed.errorMessage || 'OTP khong hop le', {
      statusCode: 400,
      details: parsed.raw
    });
  }

  return {
    message: 'Xac thuc OTP thanh cong',
    response: parsed.raw
  };
}

module.exports = {
  sendOtp,
  verifyOtp,
  OtpServiceError
};