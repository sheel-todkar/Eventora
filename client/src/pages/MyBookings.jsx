import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/bookings/my', { params: { page, limit: 20 } })
      .then(({ data }) => {
        setBookings(data.bookings);
        setTotal(data.total);
        setPages(data.pages);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [page]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      setBookings(bookings.map(b => b._id === id ? { ...b, status: 'cancelled' } : b));
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel failed');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="page container"><div className="loading-center"><div className="spinner" /><span>Loading bookings...</span></div></div>;

  return (
    <div className="page container">
      <div className="section-header">
        <div>
          <h1 className="section-title">My Bookings</h1>
          <p className="section-sub">{total} booking{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/" className="btn btn-secondary">Browse Events</Link>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎟️</div>
          <h3>No bookings yet</h3>
          <p>Book your first event to see it here</p>
        </div>
      ) : (
        <>
          <div className="bookings-list">
            {bookings.map(b => (
              <div className="booking-item" key={b._id}>
                <div className="booking-item-icon">🎫</div>
                <div className="booking-item-info">
                  <div className="booking-item-title">
                    {b.eventId ? (
                      <Link to={`/event/${b.eventId._id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {b.eventId.title}
                      </Link>
                    ) : 'Event unavailable'}
                  </div>
                  <div className="booking-item-sub">
                    {b.eventId ? formatDate(b.eventId.date) : '—'} &bull; Booked {formatDate(b.createdAt)}
                  </div>
                  <div className="booking-item-badges">
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                    <span className={`badge ${b.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}`}>{b.paymentStatus === 'paid' ? 'Paid' : 'Not Paid'}</span>
                  </div>
                </div>
                <div className="booking-item-amount">
                  {b.amount > 0 ? `₹${b.amount}` : 'Free'}
                </div>
                {b.status !== 'cancelled' && b.paymentStatus !== 'paid' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b._id)}>Cancel</button>
                )}
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={{ alignSelf: 'center', fontSize: 14, color: 'var(--text-muted)' }}>Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
