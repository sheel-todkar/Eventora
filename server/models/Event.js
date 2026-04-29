const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    date: { 
        type: Date, 
        required: true,
        validate: {
            validator: function(v) {
                return v > new Date();
            },
            message: 'Event date must be in the future'
        }
    },
    location: { 
        type: String, 
        required: true,
        trim: true 
    },
    category: { 
        type: String, 
        required: true,
        enum: ['music', 'sports', 'tech', 'food', 'art', 'education', 'other'],
        lowercase: true
    },
    totalSeats: { 
        type: Number, 
        required: true,
        min: [1, 'Must have at least 1 seat']
    },
    availableSeats: { 
        type: Number, 
        required: true,
        min: [0, 'Available seats cannot be negative']
    },
    image: { 
        type: String,
        default: ''
    },
    ticketPrice: { 
        type: Number, 
        required: true, 
        default: 0,
        min: [0, 'Price cannot be negative']
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true   // was optional before — should always have an owner
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },   // include virtuals when sending to client
    toObject: { virtuals: true }
});

// ── Indexes ────────────────────────────────────────────────
eventSchema.index({ category: 1, date: 1 });           // filter by category, sort by date
eventSchema.index({ title: 'text', description: 'text' }); // full text search
eventSchema.index({ createdBy: 1 });                    // fetch events by organizer
eventSchema.index({ date: 1, availableSeats: 1 });      // upcoming + available filter
eventSchema.index({ status: 1, date: 1 });              // filter by status

// ── Virtuals ───────────────────────────────────────────────
eventSchema.virtual('isSoldOut').get(function() {
    return this.availableSeats === 0;
});

eventSchema.virtual('bookedSeats').get(function() {
    return this.totalSeats - this.availableSeats;
});

eventSchema.virtual('occupancyPercent').get(function() {
    return Math.round((this.bookedSeats / this.totalSeats) * 100);
});

eventSchema.virtual('isFree').get(function() {
    return this.ticketPrice === 0;
});

// ── Pre-save hook ──────────────────────────────────────────
eventSchema.pre('save', function(next) {
    // auto-mark as completed if date has passed
    if (this.date < new Date() && this.status === 'upcoming') {
        this.status = 'completed';
    }
    // availableSeats should never exceed totalSeats
    if (this.availableSeats > this.totalSeats) {
        this.availableSeats = this.totalSeats;
    }
    next();
});

module.exports = mongoose.model('Event', eventSchema);