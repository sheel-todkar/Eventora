const { body, param, validationResult } = require('express-validator');

// Shared handler — returns first validation error
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: errors.array()[0].msg,
            errors: errors.array()
        });
    }
    next();
};

// ── Auth Rules ──────────────────────────────────────────────
const registerRules = [
    body('name').trim().notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginRules = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
];

const verifyOTPRules = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers'),
];

const forgotPasswordRules = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
];

const resetPasswordRules = [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

// ── Event Rules ─────────────────────────────────────────────
const createEventRules = [
    body('title').trim().notEmpty().withMessage('Title is required')
        .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('description').trim().notEmpty().withMessage('Description is required')
        .isLength({ max: 5000 }).withMessage('Description cannot exceed 5000 characters'),
    body('date').notEmpty().withMessage('Date is required')
        .isISO8601().withMessage('Invalid date format'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('totalSeats').isInt({ min: 1 }).withMessage('Total seats must be at least 1'),
    body('ticketPrice').optional().isFloat({ min: 0 }).withMessage('Price cannot be negative'),
];

const updateEventRules = [
    param('id').isMongoId().withMessage('Invalid event ID'),
    body('title').optional().trim().isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
    body('description').optional().trim().isLength({ max: 5000 }).withMessage('Description too long'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    body('totalSeats').optional().isInt({ min: 1 }).withMessage('Total seats must be at least 1'),
    body('ticketPrice').optional().isFloat({ min: 0 }).withMessage('Price cannot be negative'),
];

// ── Booking Rules ───────────────────────────────────────────
const registerBookingRules = [
    body('eventId').isMongoId().withMessage('Invalid event ID'),
];

const payNowRules = [
    body('bookingId').isMongoId().withMessage('Invalid booking ID'),
];

const verifyPaymentRules = [
    body('razorpay_order_id').notEmpty().withMessage('Order ID is required'),
    body('razorpay_payment_id').notEmpty().withMessage('Payment ID is required'),
    body('razorpay_signature').notEmpty().withMessage('Signature is required'),
    body('bookingId').isMongoId().withMessage('Invalid booking ID'),
];

module.exports = {
    validate,
    registerRules, loginRules, verifyOTPRules, forgotPasswordRules, resetPasswordRules,
    createEventRules, updateEventRules,
    registerBookingRules, payNowRules, verifyPaymentRules,
};
