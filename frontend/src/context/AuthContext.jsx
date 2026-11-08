import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/endpoints";
import { tokenStore } from "../api/client";

const AuthContext = createContext(null);
const USER_KEY = "reservas_user";

function leerUsuarioGuardado() {
  try {
    return tokenStore.get() ? JSON.parse(localStorage.getItem(USER_KEY)) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(leerUsuarioGuardado);

  const guardarSesion = (data) => {
    tokenStore.set(data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario));
    setUser(data.usuario);
  };

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // El cliente HTTP emite este evento cuando el backend responde 401 (token vencido)
  useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.rol === "admin",
      login: async (email, password) => guardarSesion(await authApi.login(email, password)),
      register: async (nombre, email, password) =>
        guardarSesion(await authApi.register(nombre, email, password)),
      logout,
    }),
    [user, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
