const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp, OtpServiceError } = require('../services/otpService');

router.post('/send', async (req, res) => {
  const { phone, content, brandName, otpType } = req.body || {};

  try {
    if (!phone) {
      return res.status(400).json({ message: 'So dien thoai la bat buoc' });
    }

    const result = await sendOtp(phone, { content, brandName, otpType });
    res.json({
      message: result.message,
      sessionId: result.sessionId,
      smsId: result.smsId,
      rawResponse: result.response
    });
  } catch (error) {
    if (error instanceof OtpServiceError) {
      return res.status(error.statusCode).json({
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({
      message: 'Loi khong xac dinh khi gui OTP',
      details: { error: error.message }
    });
  }
});

router.post('/verify', async (req, res) => {
  const { sessionId, otp, phone } = req.body || {};

  try {
    if (!sessionId) {
      return res.status(400).json({ message: 'SessionId la bat buoc' });
    }

    if (!otp) {
      return res.status(400).json({ message: 'Ma OTP la bat buoc' });
    }

    const result = await verifyOtp({ sessionId, code: otp, phone });
    res.json({
      message: result.message,
      rawResponse: result.response
    });
  } catch (error) {
    if (error instanceof OtpServiceError) {
      return res.status(error.statusCode).json({
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({
      message: 'Loi khong xac dinh khi xac thuc OTP',
      details: { error: error.message }
    });
  }
});

module.exports = router;
