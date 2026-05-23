const express = require('express');
const router = express.Router();
const { registerForEvent, payNow, verifyPayment, getBookingStatus, confirmBooking, getMyBookings, cancelBooking, getAdminStats } = require('../controllers/bookingController');
const { protect, admin } = require('../middleware/auth');
const { validate, registerBookingRules, payNowRules, verifyPaymentRules } = require('../middleware/validate');

// Admin routes
router.get('/stats', protect, admin, getAdminStats);

// User routes
router.get('/my', protect, getMyBookings);
router.get('/status/:eventId', protect, getBookingStatus);
router.post('/register', protect, registerBookingRules, validate, registerForEvent);
router.post('/pay-now', protect, payNowRules, validate, payNow);
router.post('/verify-payment', protect, verifyPaymentRules, validate, verifyPayment);
router.put('/:id/confirm', protect, admin, confirmBooking);
router.delete('/:id', protect, cancelBooking);

module.exports = router;