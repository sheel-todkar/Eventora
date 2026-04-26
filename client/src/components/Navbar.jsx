import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">Eventora</Link>
        <div className="navbar-links">
          <NavLink to="/" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`} end>
            Events
          </NavLink>

          {user ? (
            <>
              {user.role === 'admin' ? (
                <>
                  <NavLink to="/admin" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`} end>
                    Dashboard
                  </NavLink>
                  <NavLink to="/admin/events" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>
                    Manage Events
                  </NavLink>
                  <NavLink to="/admin/bookings" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>
                    Manage Bookings
                  </NavLink>
                </>
              ) : (
                <NavLink to="/my-bookings" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>
                  My Bookings
                </NavLink>
              )}

              <div className="navbar-user">
                <div className="navbar-avatar">{user.name?.charAt(0)?.toUpperCase()}</div>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Logout</button>
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}>Login</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
