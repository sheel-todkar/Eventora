const express = require('express');
const router = express.Router();
const { getEvents, getEventById, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');
const { protect, admin } = require('../middleware/auth');
const { validate, createEventRules, updateEventRules, mongoIdParam } = require('../middleware/validate');

router.get('/', getEvents);
router.get('/:id', mongoIdParam('id'), validate, getEventById);
router.post('/', protect, admin, createEventRules, validate, createEvent);
router.put('/:id', protect, admin, updateEventRules, validate, updateEvent);
router.delete('/:id', protect, admin, mongoIdParam('id'), validate, deleteEvent);

module.exports = router;