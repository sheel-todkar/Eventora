import { useEffect, useState } from 'react';
import api from '../../api/axios';

const INITIAL_FORM = { title: '', description: '', date: '', location: '', category: 'Technology', totalSeats: '', ticketPrice: '', image: '' };

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const { data } = await api.get('/events');
      setEvents(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const openCreate = () => {
    setEditId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const openEdit = (event) => {
    setEditId(event._id);
    setForm({
      title: event.title,
      description: event.description,
      date: event.date?.slice(0, 16) || '',
      location: event.location,
      category: event.category,
      totalSeats: event.totalSeats,
      ticketPrice: event.ticketPrice,
      image: event.image || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        totalSeats: Number(form.totalSeats),
        ticketPrice: Number(form.ticketPrice) || 0,
      };
      if (editId) {
        await api.put(`/events/${editId}`, payload);
      } else {
        await api.post('/events', payload);
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await api.delete(`/events/${id}`);
      setEvents(events.filter(e => e._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="page container"><div className="loading-center"><div className="spinner" /><span>Loading events...</span></div></div>;

  return (
    <div className="page container">
      <div className="section-header">
        <div>
          <h1 className="section-title">Manage Events</h1>
          <p className="section-sub">{events.length} event{events.length !== 1 ? 's' : ''} in total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Event</button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📅</div><h3>No events yet</h3><p>Create your first event above</p></div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Event</th><th>Date</th><th>Category</th><th>Price</th><th>Seats</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev._id}>
                  <td><strong>{ev.title}</strong><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ev.location}</span></td>
                  <td>{formatDate(ev.date)}</td>
                  <td><span className="badge badge-free">{ev.category}</span></td>
                  <td>{ev.ticketPrice > 0 ? `₹${ev.ticketPrice}` : 'Free'}</td>
                  <td>{ev.availableSeats} / {ev.totalSeats}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(ev)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ev._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h2 className="modal-title">{editId ? 'Edit Event' : 'Create Event'}</h2>
            <p className="modal-sub">{editId ? 'Update the event details below' : 'Fill in the details for your new event'}</p>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" name="title" value={form.title} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" name="description" value={form.description} onChange={handleChange} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Date &amp; Time</label>
                  <input className="form-input" name="date" type="datetime-local" value={form.date} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                    {['Technology', 'Community', 'Music', 'Business', 'Sports', 'Arts', 'Education'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" name="location" value={form.location} onChange={handleChange} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Total Seats</label>
                  <input className="form-input" name="totalSeats" type="number" min="1" value={form.totalSeats} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Ticket Price (₹)</label>
                  <input className="form-input" name="ticketPrice" type="number" min="0" value={form.ticketPrice} onChange={handleChange} placeholder="0 for free" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Image URL (optional)</label>
                <input className="form-input" name="image" value={form.image} onChange={handleChange} placeholder="https://..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editId ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
