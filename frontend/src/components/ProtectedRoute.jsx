import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Exige sesión iniciada y, opcionalmente, rol de administrador
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/reservas" replace />;
  return children;
}
