import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function PrivateRoute({ children, requiredRole }) {
    const { user } = useAuth();

    // Not logged in
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // If a specific role is required and doesn’t match → redirect
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/" replace />;
    }

    // Otherwise, allow access
    return children;
}
