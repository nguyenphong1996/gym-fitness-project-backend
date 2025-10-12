// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/register - send OTP for registration
router.post('/register', authController.register);

// POST /api/auth/verify-register - verify OTP and create user
router.post('/verify-register', authController.verifyRegister);

// POST /api/auth/login - send OTP for login
router.post('/login', authController.login);

// POST /api/auth/verify-login - verify OTP and login
router.post('/verify-login', authController.verifyLogin);

module.exports = router;