const express = require('express');
const router = express.Router();
const { registerForEvent, payNow, verifyPayment, getBookingStatus, confirmBooking, getMyBookings, cancelBooking, getAdminStats } = require('../controllers/bookingController');
const { protect, admin } = require('../middleware/auth');
const {
    validate,
    registerBookingRules,
    payNowRules,
    verifyPaymentRules,
    mongoIdParam,
    paginationRules,
    confirmBookingRules,
} = require('../middleware/validate');

// Admin routes
router.get('/stats', protect, admin, getAdminStats);

// User routes
router.get('/my', protect, paginationRules, validate, getMyBookings);
router.get('/status/:eventId', protect, mongoIdParam('eventId'), validate, getBookingStatus);
router.post('/register', protect, registerBookingRules, validate, registerForEvent);
router.post('/pay-now', protect, payNowRules, validate, payNow);
router.post('/verify-payment', protect, verifyPaymentRules, validate, verifyPayment);
router.put('/:id/confirm', protect, admin, confirmBookingRules, validate, confirmBooking);
router.delete('/:id', protect, mongoIdParam('id'), validate, cancelBooking);

module.exports = router;