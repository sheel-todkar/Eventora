import { useState } from 'react';
import { useLocation, useNavigate, Navigate, Link } from 'react-router-dom';
import api from '../api/axios';

export default function ResetPassword() {
  const { state } = useLocation();
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!state?.email) return <Navigate to="/forgot-password" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: state.email,
        otp,
        newPassword
      });
      navigate('/login', { state: { resetSuccess: true } });
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Eventora</div>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">We sent a 6-digit code to <strong>{state.email}</strong></p>
        {error && <div className="auth-error">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">OTP Code</label>
            <input
              className="form-input"
              type="text"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <div className="auth-footer">
          <Link to="/forgot-password">Resend code</Link> · <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
