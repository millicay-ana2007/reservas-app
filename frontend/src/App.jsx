import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Menu from "./pages/Menu";
import Mesas from "./pages/Mesas";
import Pedidos from "./pages/Pedidos";
import Reportes from "./pages/Reportes";
import Reservas from "./pages/Reservas";
import Restaurantes from "./pages/Restaurantes";
import Salon from "./pages/Salon";
import Usuarios from "./pages/Usuarios";

export default function App() {
  const { user, isAdmin } = useAuth();
  const inicio = !user ? "/login" : isAdmin ? "/dashboard" : "/reservas";

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/reservas" element={<Reservas />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/dashboard" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/pedidos" element={<ProtectedRoute adminOnly><Pedidos /></ProtectedRoute>} />
        <Route path="/salon" element={<ProtectedRoute adminOnly><Salon /></ProtectedRoute>} />
        <Route path="/restaurantes" element={<ProtectedRoute adminOnly><Restaurantes /></ProtectedRoute>} />
        <Route path="/mesas" element={<ProtectedRoute adminOnly><Mesas /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute adminOnly><Usuarios /></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute adminOnly><Reportes /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={inicio} replace />} />
    </Routes>
  );
}
