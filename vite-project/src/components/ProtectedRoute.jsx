import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Gate for pages that only make sense for a logged-in user.
// Auth state comes from AuthContext so every guard sees the same value.
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    // Send the user home and remember where they were heading.
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
