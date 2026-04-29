import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function MapPinIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function TagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) return resolve(true);
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const mounted = useRef(true);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [bookingStatus, setBookingStatus] = useState({ registered: false, booking: null });
  const [statusLoading, setStatusLoading] = useState(false);

  // prevent state updates after unmount
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/events/${id}`)
      .then(({ data }) => {
        if (!mounted.current) return;
        setEvent(data);
      })
      .catch(() => {
        if (!mounted.current) return;
        setError('Event not found or failed to load.');
      })
      .finally(() => {
        if (!mounted.current) return;
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setStatusLoading(true);
    api.get(`/bookings/status/${id}`)
      .then(({ data }) => {
        if (!mounted.current) return;
        setBookingStatus(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted.current) return;
        setStatusLoading(false);
      });
  }, [id, user]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  const formatTime = (d) =>
    new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const handleRegister = async () => {
    if (!user) { navigate('/login'); return; }
    setActionLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/bookings/register', { eventId: id });
      if (!mounted.current) return;
      setMessage(`✅ ${data.message}`);
      setBookingStatus({ registered: true, booking: data.booking });
      if (data.free) {
        setEvent(prev => ({ ...prev, availableSeats: (prev.availableSeats ?? 1) - 1 }));
      }
    } catch (err) {
      if (!mounted.current) return;
      setMessage(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      if (mounted.current) setActionLoading(false);
    }
  };

  const handlePay = async () => {
    setActionLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/bookings/pay-now', {
        bookingId: bookingStatus.booking._id,
      });

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setMessage('Failed to load payment gateway. Please try again.');
        setActionLoading(false);
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Eventora',
        description: `Booking for ${data.eventTitle}`,
        order_id: data.orderId,
        prefill: { name: data.userName, email: data.userEmail },
        theme: { color: '#7c3aed' },
        handler: async (response) => {
          try {
            await api.post('/bookings/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId: data.bookingId,
            });
            if (!mounted.current) return;
            setMessage('✅ Payment successful! Your booking is confirmed.');
            setBookingStatus(prev => ({
              ...prev,
              booking: { ...prev.booking, status: 'confirmed', paymentStatus: 'paid' },
            }));
            setEvent(prev => ({
              ...prev,
              availableSeats: (prev.availableSeats ?? 1) - 1,
            }));
          } catch {
            if (mounted.current) setMessage('Payment verification failed. Please contact support.');
          } finally {
            // always release loading after payment handler finishes
            if (mounted.current) setActionLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (mounted.current) {
              setMessage('Payment cancelled. You can pay anytime from My Bookings.');
              setActionLoading(false);
            }
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      if (mounted.current) {
        setMessage(err.response?.data?.message || 'Payment failed. Please try again.');
        setActionLoading(false);
      }
    }
  };

  // ── Render guards ──────────────────────────────────────────
  if (loading) return (
    <div className="page container">
      <div className="loading-center">
        <div className="spinner" />
        <span>Loading event...</span>
      </div>
    </div>
  );

  if (error || !event) return (
    <div className="page container">
      <div className="empty-state">
        <div className="empty-state-icon">😕</div>
        <h3>{error || 'Event not found'}</h3>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Events
        </button>
      </div>
    </div>
  );

  // safe defaults so nothing crashes if fields are missing
  const availableSeats = event.availableSeats ?? 0;
  const totalSeats = event.totalSeats ?? 1; // avoid division by zero
  const occupancy = Math.min((availableSeats / totalSeats) * 100, 100);

  const b = bookingStatus.booking;
  const isConfirmedPaid = b?.status === 'confirmed' && b?.paymentStatus === 'paid';
  const isConfirmedFree = b?.status === 'confirmed' && event.ticketPrice === 0;
  const isPendingUnpaid = b?.status === 'pending' && b?.paymentStatus === 'not_paid';

  const isSuccess = message.startsWith('✅');

  return (
    <div className="page container">
      {event.image ? (
        <img src={event.image} alt={event.title} className="event-detail-hero" />
      ) : (
        <div className="event-detail-hero-placeholder">🎪</div>
      )}

      <div className="event-detail-layout">
        {/* Left: Event Info */}
        <div>
          <div className="badge badge-free" style={{ marginBottom: 16 }}>
            {event.category}
          </div>
          <h1 className="event-detail-title">{event.title}</h1>
          <div className="event-detail-meta">
            <div className="event-detail-meta-item">
              <CalendarIcon /> {formatDate(event.date)} at {formatTime(event.date)}
            </div>
            <div className="event-detail-meta-item">
              <MapPinIcon /> {event.location}
            </div>
            <div className="event-detail-meta-item">
              <UsersIcon /> {availableSeats} of {totalSeats} seats available
            </div>
            <div className="event-detail-meta-item">
              <TagIcon /> {event.ticketPrice > 0 ? `₹${event.ticketPrice} per ticket` : 'Free entry'}
            </div>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            About This Event
          </h3>
          <p className="event-detail-description">{event.description}</p>
        </div>

        {/* Right: Booking Box */}
        <div className="booking-box">
          <div className="booking-price">
            {event.ticketPrice > 0 ? `₹${event.ticketPrice}` : 'Free'}
          </div>
          <div className="booking-price-sub">
            {event.ticketPrice > 0 ? 'per ticket (incl. taxes)' : 'No payment required'}
          </div>

          {/* Seats progress bar */}
          <div className="booking-seats" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span>Available</span>
              <span>{availableSeats} / {totalSeats}</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${occupancy}%`,
                background: 'var(--gradient)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '12px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
              background: isSuccess ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: isSuccess ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            }}>
              {message}
            </div>
          )}

          {/* Booking Action */}
          {statusLoading ? (
            <div className="loading-center" style={{ minHeight: 60 }}>
              <div className="spinner" />
            </div>
          ) : isConfirmedPaid || isConfirmedFree ? (
            <div>
              <div style={{ padding: 16, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--success)' }}>You are registered!</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {isConfirmedPaid ? 'Payment received — your spot is confirmed.' : 'Free event — your spot is confirmed.'}
                </div>
              </div>
              <button className="btn btn-secondary btn-full" disabled>Already Booked</button>
            </div>
          ) : isPendingUnpaid ? (
            <div>
              <div style={{ padding: 16, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--warning)' }}>Payment Pending</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Complete payment to confirm your spot.
                </div>
              </div>
              <button className="btn btn-primary btn-full" onClick={handlePay} disabled={actionLoading}>
                {actionLoading ? 'Processing...' : `Pay ₹${event.ticketPrice} Now`}
              </button>
            </div>
          ) : availableSeats > 0 ? (
            <button className="btn btn-primary btn-full" onClick={handleRegister} disabled={actionLoading}>
              {actionLoading ? 'Registering...' : event.ticketPrice > 0 ? 'Register for This Event' : 'Register — Free'}
            </button>
          ) : (
            <button className="btn btn-secondary btn-full" disabled>Sold Out</button>
          )}

          {!user && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
              You need to login to register
            </p>
          )}
        </div>
      </div>
    </div>
  );
}