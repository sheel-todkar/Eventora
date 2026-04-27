const Booking = require('../models/Booking');
const Event = require('../models/Event');
const OTP = require('../models/OTP');
const { sendBookingEmail, sendOTPEmail } = require('../utils/email');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// POST /api/bookings/create-order  (requires auth)
// POST /api/bookings/register  — Step 1: Register for an event (creates pending booking, no payment)
exports.registerForEvent = async (req, res) => {
    try {
        const { eventId } = req.body;

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        if (event.availableSeats <= 0) return res.status(400).json({ message: 'No seats available' });

        // Check for existing active booking
        const existing = await Booking.findOne({
            userId: req.user.id,
            eventId,
            status: { $in: ['pending', 'confirmed'] }
        });
        if (existing) return res.status(400).json({ message: 'You are already registered for this event', booking: existing });

        // For free events, confirm immediately
        if (event.ticketPrice === 0) {
            const booking = await Booking.create({
                userId: req.user.id,
                eventId,
                status: 'confirmed',
                paymentStatus: 'not_paid',
                amount: 0
            });
            event.availableSeats -= 1;
            await event.save();
            return res.status(201).json({ message: 'Registration confirmed! This is a free event.', booking, free: true });
        }

        // For paid events, create a pending booking (no payment yet)
        const booking = await Booking.create({
            userId: req.user.id,
            eventId,
            status: 'pending',
            paymentStatus: 'not_paid',
            amount: event.ticketPrice
        });

        res.status(201).json({ message: 'Registered successfully! Please complete payment to confirm your spot.', booking });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// POST /api/bookings/pay-now  — Step 2: Create Razorpay order for an existing pending booking
exports.payNow = async (req, res) => {
    try {
        const { bookingId } = req.body;

        const booking = await Booking.findById(bookingId).populate('eventId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
        if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'Already paid and confirmed' });
        }
        if (booking.status === 'cancelled') return res.status(400).json({ message: 'Booking was cancelled' });

        const event = booking.eventId;
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Create Razorpay order (amount in paise)
        const options = {
            amount: booking.amount * 100,
            currency: 'INR',
            receipt: `rcpt_${req.user.id}_${booking._id}`.slice(0, 40),
            notes: {
                eventId: event._id.toString(),
                userId: req.user.id.toString(),
                bookingId: booking._id.toString()
            }
        };

        const order = await razorpay.orders.create(options);

        // Save the order ID on the booking
        booking.razorpayOrderId = order.id;
        await booking.save();

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            bookingId: booking._id,
            eventTitle: event.title,
            userName: req.user.name,
            userEmail: req.user.email
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating payment order', error: error.message });
    }
};

// GET /api/bookings/status/:eventId  — Check if user has a booking for this event
exports.getBookingStatus = async (req, res) => {
    try {
        const booking = await Booking.findOne({
            userId: req.user.id,
            eventId: req.params.eventId,
            status: { $in: ['pending', 'confirmed'] }
        });
        if (!booking) return res.json({ registered: false });
        res.json({ registered: true, booking });
    } catch (error) {
        res.status(500).json({ message: 'Error checking status', error: error.message });
    }
};

// POST /api/bookings/verify-payment  (requires auth)
exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment verification failed: invalid signature' });
        }

        // Update booking
        const booking = await Booking.findById(bookingId).populate('eventId').populate('userId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        booking.razorpayPaymentId = razorpay_payment_id;
        await booking.save();

        // Deduct seat
        const event = await Event.findById(booking.eventId._id);
        if (event && event.availableSeats > 0) {
            event.availableSeats -= 1;
            await event.save();
        }

        // Send confirmation email
        await sendBookingEmail(booking.userId.email, booking.userId.name, booking.eventId.title);

        res.json({ message: 'Payment verified successfully', booking });
    } catch (error) {
        res.status(500).json({ message: 'Payment verification error', error: error.message });
    }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendBookingOTP = async (req, res) => {
    try {
        const otp = generateOTP();
        await OTP.findOneAndDelete({ email: req.user.email, action: 'event_booking' });
        await OTP.create({ email: req.user.email, otp, action: 'event_booking' });
        await sendOTPEmail(req.user.email, otp, 'event_booking');
        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending OTP', error: error.message });
    }
};

exports.bookEvent = async (req, res) => {
    try {
        const { eventId, otp } = req.body;

        // Verify OTP explicitly before proceeding
        const validOTP = await OTP.findOne({ email: req.user.email, otp, action: 'event_booking' });
        if (!validOTP) {
            return res.status(400).json({ message: 'Invalid or expired OTP for booking' });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        if (event.availableSeats <= 0) return res.status(400).json({ message: 'No seats available' });

        const existingBooking = await Booking.findOne({ userId: req.user.id, eventId });
        if (existingBooking && existingBooking.status !== 'cancelled') {
            return res.status(400).json({ message: 'Already booked or pending' });
        }

        const booking = await Booking.create({
            userId: req.user.id,
            eventId,
            status: 'pending',
            paymentStatus: 'not_paid',
            amount: event.ticketPrice
        });

        await OTP.deleteOne({ _id: validOTP._id }); // cleanup

        res.status(201).json({ message: 'Booking request submitted', booking });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.confirmBooking = async (req, res) => {
    try {
        const { paymentStatus } = req.body; // 'paid' or 'not_paid'
        const booking = await Booking.findById(req.params.id).populate('userId').populate('eventId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.status === 'confirmed') return res.status(400).json({ message: 'Booking is already confirmed' });

        const event = await Event.findById(booking.eventId._id);
        if (event.availableSeats <= 0) {
            return res.status(400).json({ message: 'No seats available to confirm this booking' });
        }

        booking.status = 'confirmed';
        if (paymentStatus) {
            booking.paymentStatus = paymentStatus;
        }
        await booking.save();

        event.availableSeats -= 1;
        await event.save();

        // Send email on admin confirmation
        await sendBookingEmail(booking.userId.email, booking.userId.name, booking.eventId.title);

        res.json({ message: 'Booking confirmed successfully', booking });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const [events, bookings] = await Promise.all([
            Event.find(),
            Booking.find().populate('eventId')
        ]);

        const totalEvents = events.length;
        const totalBookedSeats = events.reduce((sum, e) => sum + (e.totalSeats - e.availableSeats), 0);
        const totalSeats = events.reduce((sum, e) => sum + e.totalSeats, 0);

        const confirmed = bookings.filter(b => b.status === 'confirmed');
        const pending = bookings.filter(b => b.status === 'pending');
        const cancelled = bookings.filter(b => b.status === 'cancelled');

        // Revenue = sum of amount for all confirmed bookings
        const revenue = confirmed.reduce((sum, b) => sum + (b.amount || 0), 0);

        res.json({
            totalEvents,
            totalBookedSeats,
            totalSeats,
            totalBookings: bookings.length,
            confirmed: confirmed.length,
            pending: pending.length,
            cancelled: cancelled.length,
            revenue
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getMyBookings = async (req, res) => {
    try {
        const bookings = req.user.role === 'admin'
            ? await Booking.find().populate('eventId').populate('userId', 'name email').sort({ createdAt: -1 })
            : await Booking.find({ userId: req.user.id }).populate('eventId').sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });
        if (booking.userId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (booking.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });
        if (booking.paymentStatus === 'paid') return res.status(400).json({ message: 'Cannot cancel a paid booking. Please process a refund first.' });

        const wasConfirmed = booking.status === 'confirmed';

        booking.status = 'cancelled';
        await booking.save();

        // Only restore the seat if it was actually confirmed and deducted
        if (wasConfirmed) {
            const event = await Event.findById(booking.eventId);
            if (event) {
                event.availableSeats += 1;
                await event.save();
            }
        }

        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};