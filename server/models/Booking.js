const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    quantity: {
        type: Number,
        default:1
        
    },
    status:{
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: { 
        type: String, 
        enum: ['pending', 'paid', 'failed', 'not_paid'], 
        default: 'pending' 
    },
    amount: { type: Number, required: true },

    razorpayOrderId: String,
    razorpayPaymentId: String,

}, { timestamps: true });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ eventId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);

    
