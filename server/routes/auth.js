const express = require('express');
const router = express.Router();
const { register, login, verifyOTP, forgotPassword, resetPassword } = require('../controllers/authController');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { validate, registerRules, loginRules, verifyOTPRules, forgotPasswordRules, resetPasswordRules } = require('../middleware/validate');

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.post('/verify-otp', otpLimiter, verifyOTPRules, validate, verifyOTP);
router.post('/forgot-password', authLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/reset-password', otpLimiter, resetPasswordRules, validate, resetPassword);

module.exports = router;