const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const { sendBookingEmail } = require('../utils/email');
const { getCache, setCache, deleteCache, deleteCachePattern } = require('../utils/redis');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Invalidate all caches affected by seat changes or booking mutations.
 */
const invalidateBookingCaches = async (eventId) => {
    await Promise.all([
        deleteCache(`event:${eventId}`),
        deleteCachePattern('events:*'),
        deleteCache('admin:stats'),
    ]);
};

// POST /api/bookings/register — Register for an event (free = confirm, paid = pending)
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

        // For free events — confirm immediately with atomic seat deduction
        if (event.ticketPrice === 0) {
            const updated = await Event.findOneAndUpdate(
                { _id: eventId, availableSeats: { $gt: 0 } },
                { $inc: { availableSeats: -1 } },
                { returnDocument: 'after' }
            );
            if (!updated) return res.status(400).json({ message: 'No seats available' });

            const booking = await Booking.create({
                userId: req.user.id,
                eventId,
                status: 'confirmed',
                paymentStatus: 'not_paid',
                amount: 0
            });

            // Invalidate caches (seat count changed)
            await invalidateBookingCaches(eventId);

            // Send confirmation email for free events
            try {
                const registeredUser = await User.findById(req.user.id);
                if (registeredUser) {
                    await sendBookingEmail(registeredUser.email, registeredUser.name, event.title);
                }
            } catch (emailErr) {
                console.error('Email send failed (free event):', emailErr.message);
            }

            return res.status(201).json({ message: 'Registration confirmed! This is a free event.', booking, free: true });
        }

        // For paid events — create a pending booking (no payment yet)
        const booking = await Booking.create({
            userId: req.user.id,
            eventId,
            status: 'pending',
            paymentStatus: 'not_paid',
            amount: event.ticketPrice
        });

        // Invalidate stats cache (booking count changed)
        await deleteCache('admin:stats');

        res.status(201).json({ message: 'Registered successfully! Please complete payment to confirm your spot.', booking });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

// POST /api/bookings/pay-now — Create Razorpay order for a pending booking
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

// GET /api/bookings/status/:eventId — Check if user has a booking for this event
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

// POST /api/bookings/verify-payment — Verify Razorpay payment signature
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

        // Atomic seat deduction FIRST — prevents overbooking under concurrency
        const booking = await Booking.findById(bookingId).populate('eventId').populate('userId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        const seatUpdate = await Event.findOneAndUpdate(
            { _id: booking.eventId._id, availableSeats: { $gt: 0 } },
            { $inc: { availableSeats: -1 } },
            { returnDocument: 'after' }
        );

        if (!seatUpdate) {
            // No seats available — mark payment as failed, don't confirm
            booking.status = 'cancelled';
            booking.paymentStatus = 'failed';
            booking.razorpayPaymentId = razorpay_payment_id;
            await booking.save();
            return res.status(400).json({
                message: 'No seats available. Payment received but booking could not be confirmed. A refund will be processed.',
                booking
            });
        }

        // Seats available — confirm the booking
        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        booking.razorpayPaymentId = razorpay_payment_id;
        await booking.save();

        // Invalidate caches
        await invalidateBookingCaches(booking.eventId._id);

        // Send confirmation email
        await sendBookingEmail(booking.userId.email, booking.userId.name, booking.eventId.title);

        res.json({ message: 'Payment verified successfully', booking });
    } catch (error) {
        res.status(500).json({ message: 'Payment verification error', error: error.message });
    }
};

// PUT /api/bookings/:id/confirm — Admin confirms a pending booking
exports.confirmBooking = async (req, res) => {
    try {
        const { paymentStatus } = req.body; // 'paid' or 'not_paid'
        const booking = await Booking.findById(req.params.id).populate('userId').populate('eventId');
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (booking.status === 'confirmed') return res.status(400).json({ message: 'Booking is already confirmed' });

        // Atomic seat deduction — prevents overbooking
        const updated = await Event.findOneAndUpdate(
            { _id: booking.eventId._id, availableSeats: { $gt: 0 } },
            { $inc: { availableSeats: -1 } },
            { returnDocument: 'after' }
        );
        if (!updated) {
            return res.status(400).json({ message: 'No seats available to confirm this booking' });
        }

        booking.status = 'confirmed';
        if (paymentStatus) {
            booking.paymentStatus = paymentStatus;
        }
        await booking.save();

        // Invalidate caches
        await invalidateBookingCaches(booking.eventId._id);

        // Send email on admin confirmation
        await sendBookingEmail(booking.userId.email, booking.userId.name, booking.eventId.title);

        res.json({ message: 'Booking confirmed successfully', booking });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// GET /api/bookings/stats — Admin-only aggregate stats
exports.getAdminStats = async (req, res) => {
    try {
        // Check cache
        const cacheKey = 'admin:stats';
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const [eventStats, bookingStats] = await Promise.all([
            Event.aggregate([
                { $group: {
                    _id: null,
                    totalEvents: { $sum: 1 },
                    totalSeats: { $sum: '$totalSeats' },
                    totalBookedSeats: { $sum: { $subtract: ['$totalSeats', '$availableSeats'] } }
                }}
            ]),
            Booking.aggregate([
                { $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    revenue: { $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$amount', 0] } }
                }}
            ])
        ]);

        const stats = bookingStats.reduce((acc, s) => {
            acc[s._id] = s.count;
            acc.totalBookings = (acc.totalBookings || 0) + s.count;
            if (s._id === 'confirmed') acc.revenue = s.revenue;
            return acc;
        }, { revenue: 0, totalBookings: 0 });

        const result = { ...eventStats[0], ...stats };
        await setCache(cacheKey, result, 30); // cache for 30 seconds
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// GET /api/bookings/my — Paginated bookings (admin: all, user: own)
exports.getMyBookings = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const filter = req.user.role === 'admin' ? {} : { userId: req.user.id };
        const status = req.query.status;
        if (req.user.role === 'admin' && status && status !== 'all') {
            filter.status = status;
        }

        const query = Booking.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        if (req.user.role === 'admin') {
            query.populate('eventId').populate('userId', 'name email');
        } else {
            query.populate('eventId');
        }

        const [bookings, total] = await Promise.all([
            query.lean(),
            Booking.countDocuments(filter),
        ]);

        res.json({
            bookings,
            total,
            page,
            pages: Math.ceil(total / limit) || 1,
            limit,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// DELETE /api/bookings/:id — Cancel a booking
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
        const eventId = booking.eventId;

        booking.status = 'cancelled';
        await booking.save();

        // Atomic seat restore — only if booking was confirmed (seat was deducted)
        if (wasConfirmed) {
            await Event.findOneAndUpdate(
                { _id: eventId },
                { $inc: { availableSeats: 1 } }
            );
        }

        // Invalidate caches
        await invalidateBookingCaches(eventId);

        res.json({ message: 'Booking cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};