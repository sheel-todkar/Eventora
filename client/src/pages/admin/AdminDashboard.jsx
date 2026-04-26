import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ events: 0, bookings: 0, revenue: 0, confirmed: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, bookingsRes] = await Promise.all([
          api.get('/events'),
          api.get('/bookings/my') // admin gets all bookings
        ]);
        const events = eventsRes.data;
        const bookings = bookingsRes.data;
        const confirmed = bookings.filter(b => b.status === 'confirmed');
        const revenue = confirmed.reduce((sum, b) => sum + (b.amount || 0), 0);

        setStats({
          events: events.length,
          bookings: bookings.length,
          revenue,
          confirmed: confirmed.length
        });
        setRecentBookings(bookings.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  if (loading) return <div className="page container"><div className="loading-center"><div className="spinner" /><span>Loading dashboard...</span></div></div>;

  return (
    <div className="page container">
      <div className="section-header">
        <div>
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-sub">Overview of your Eventora platform</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value gradient">{stats.events}</div>
          <div className="stat-label">Total Events</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎟️</div>
          <div className="stat-value gradient">{stats.bookings}</div>
          <div className="stat-label">Total Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value gradient">{stats.confirmed}</div>
          <div className="stat-label">Confirmed</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-value gradient">₹{stats.revenue.toLocaleString('en-IN')}</div>
          <div className="stat-label">Revenue</div>
        </div>
      </div>

      <div className="section-header">
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Recent Bookings</h2>
        <Link to="/admin/bookings" className="btn btn-secondary btn-sm">View All →</Link>
      </div>

      {recentBookings.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No bookings yet</h3></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>User</th><th>Event</th><th>Status</th><th>Payment</th><th>Amount</th><th>Date</th></tr>
            </thead>
            <tbody>
              {recentBookings.map(b => (
                <tr key={b._id}>
                  <td><strong>{b.userId?.name || '—'}</strong><br /><span style={{ fontSize: 12 }}>{b.userId?.email}</span></td>
                  <td>{b.eventId?.title || '—'}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td><span className={`badge ${b.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}`}>{b.paymentStatus}</span></td>
                  <td>{b.amount > 0 ? `₹${b.amount}` : 'Free'}</td>
                  <td>{formatDate(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
