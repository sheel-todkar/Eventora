const express = require('express');
const router = express.Router();
const { bookEvent, confirmBooking, getMyBookings, cancelBooking, sendBookingOTP, registerForEvent, payNow, verifyPayment, getBookingStatus, getAdminStats } = require('../controllers/bookingController');
const { protect, admin } = require('../middleware/auth');

router.get('/stats', protect, admin, getAdminStats);

router.post('/send-otp', protect, sendBookingOTP);
router.post('/', protect, bookEvent);
router.put('/:id/confirm', protect, admin, confirmBooking);
router.get('/my', protect, getMyBookings);
router.delete('/:id', protect, cancelBooking);

// New booking flow: register → pay → verify
router.post('/register', protect, registerForEvent);
router.post('/pay-now', protect, payNow);
router.post('/verify-payment', protect, verifyPayment);
router.get('/status/:eventId', protect, getBookingStatus);

module.exports = router;