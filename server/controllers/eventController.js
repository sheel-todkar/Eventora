const Event = require('../models/Event');
const { getCache, setCache, deleteCache, deleteCachePattern } = require('../utils/redis');

exports.getEvents = async (req, res) => {
    try {
        const filters = {};
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const category = req.query.category || '';
        const search = req.query.search || '';

        // Check cache
        const cacheKey = `events:p:${page}:l:${limit}:c:${category}:s:${search}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        if (category) filters.category = category;
        if (search) filters.$text = { $search: search }; // uses text index, not $regex

        const [events, total] = await Promise.all([
            Event.find(filters)
                .populate('createdBy', 'name email')
                .sort({ date: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),           // .lean() returns plain JS objects, 30-50% faster
            Event.countDocuments(filters)
        ]);

        const result = { events, total, page, pages: Math.ceil(total / limit) };
        await setCache(cacheKey, result, 60); // cache for 60 seconds
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.getEventById = async (req, res) => {
    try {
        // Check cache
        const cacheKey = `event:${req.params.id}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const event = await Event.findById(req.params.id).populate('createdBy', 'name email');
        if (!event) return res.status(404).json({ message: 'Event not found' });

        await setCache(cacheKey, event.toJSON(), 120); // cache for 120 seconds
        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, location, category, totalSeats, ticketPrice, image } = req.body;
        const event = await Event.create({
            title,
            description,
            date,
            location,
            category,
            totalSeats,
            availableSeats: totalSeats,
            ticketPrice: ticketPrice || 0,
            image: image || '',
            createdBy: req.user.id
        });

        // Invalidate event list cache
        await deleteCachePattern('events:*');

        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        // Whitelist — only allow safe fields to be updated
        const allowed = ['title', 'description', 'date', 'location', 'category', 'totalSeats', 'ticketPrice', 'image'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Invalidate caches
        await deleteCache(`event:${req.params.id}`);
        await deleteCachePattern('events:*');

        res.json(event);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Invalidate caches
        await deleteCache(`event:${req.params.id}`);
        await deleteCachePattern('events:*');
        await deleteCache('admin:stats');

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};