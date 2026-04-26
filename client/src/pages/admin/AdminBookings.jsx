import { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/bookings/my')
      .then(({ data }) => setBookings(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleConfirm = async (id) => {
    try {
      const { data } = await api.put(`/bookings/${id}/confirm`, { paymentStatus: 'paid' });
      setBookings(bookings.map(b => b._id === id ? { ...b, status: 'confirmed', paymentStatus: 'paid' } : b));
    } catch (err) {
      alert(err.response?.data?.message || 'Confirmation failed');
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      setBookings(bookings.map(b => b._id === id ? { ...b, status: 'cancelled' } : b));
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel failed');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  if (loading) return <div className="page container"><div className="loading-center"><div className="spinner" /><span>Loading bookings...</span></div></div>;

  return (
    <div className="page container">
      <div className="section-header">
        <div>
          <h1 className="section-title">Manage Bookings</h1>
          <p className="section-sub">{bookings.length} total booking{bookings.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'pending', 'confirmed', 'cancelled'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No {filter !== 'all' ? filter : ''} bookings</h3></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Event</th><th>Amount</th><th>Status</th><th>Payment</th><th>Booked On</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b._id}>
                  <td>
                    <strong>{b.userId?.name || '—'}</strong>
                    <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.userId?.email}</span>
                  </td>
                  <td>{b.eventId?.title || '—'}</td>
                  <td>{b.amount > 0 ? `₹${b.amount}` : 'Free'}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td><span className={`badge ${b.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}`}>{b.paymentStatus}</span></td>
                  <td>{formatDate(b.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {b.status === 'pending' && (
                        <button className="btn btn-success btn-sm" onClick={() => handleConfirm(b._id)}>Confirm</button>
                      )}
                      {b.status !== 'cancelled' && b.paymentStatus !== 'paid' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b._id)}>Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
