import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const CATEGORIES = ['All', 'Technology', 'Community', 'Music', 'Business', 'Sports', 'Arts', 'Education', 'Other'];

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (search) params.search = search;
      if (category !== 'All') params.category = category.toLowerCase();
      const { data } = await api.get('/events', { params });
      // handles both { events: [...] } and plain array response
      setEvents(Array.isArray(data) ? data : data.events ?? []);
    } catch (err) {
      console.error('Failed to fetch events', err);
      setError('Failed to load events. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  // debounce — waits 400ms after user stops typing before fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero container">
        <div className="hero-tag">✦ Your Next Event Awaits</div>
        <h1>
          Discover &amp; Book<br />
          <span>Amazing Events</span>
        </h1>
        <p className="hero-sub">
          Browse conferences, meetups, workshops and concerts. Book your spot with secure payments.
        </p>
      </section>

      {/* Events Section */}
      <section className="container" style={{ paddingBottom: '60px' }}>
        <div className="search-bar">
          <input
            className="form-input"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="spinner" />
            <span>Loading events...</span>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchEvents}>
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h3>No events found</h3>
            <p>Try a different search or category filter</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event) => (
              <Link to={`/event/${event._id}`} className="event-card" key={event._id}>
                <div className="event-card-img">
                  {event.image ? (
                    <img src={event.image} alt={event.title} loading="lazy" />
                  ) : (
                    <div className="event-card-img-placeholder">🎪</div>
                  )}
                  <div className="event-card-cat">{event.category}</div>
                </div>
                <div className="event-card-body">
                  <div className="event-card-title">{event.title}</div>
                  <div className="event-card-meta">
                    <div className="event-card-meta-item">
                      <CalendarIcon />
                      {formatDate(event.date)}
                    </div>
                    <div className="event-card-meta-item">
                      <MapPinIcon />
                      {event.location}
                    </div>
                  </div>
                  <div className="event-card-footer">
                    <span className="event-price">
                      {event.ticketPrice > 0 ? `₹${event.ticketPrice}` : 'Free'}
                    </span>
                    <span className="event-seats">
                      {event.availableSeats} / {event.totalSeats} seats
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}