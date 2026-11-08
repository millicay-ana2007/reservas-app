import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MENU_ADMIN = [
  { to: "/dashboard", label: "Panel" },
  { to: "/reservas", label: "Reservas" },
  { to: "/salon", label: "Mesas en vivo" },
  { to: "/pedidos", label: "Pedidos de hoy" },
  { to: "/restaurantes", label: "Restaurantes" },
  { to: "/mesas", label: "Mesas" },
  { to: "/menu", label: "Menú" },
  { to: "/usuarios", label: "Usuarios" },
  { to: "/reportes", label: "Reportes" },
];
const MENU_CLIENTE = [
  { to: "/reservas", label: "Mis reservas" },
  { to: "/menu", label: "Menú" },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const menu = isAdmin ? MENU_ADMIN : MENU_CLIENTE;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Salón</div>
        <nav aria-label="Principal">
          {menu.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <strong>{user.nombre}</strong>
          <span>{isAdmin ? "Administrador" : "Cliente"}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
