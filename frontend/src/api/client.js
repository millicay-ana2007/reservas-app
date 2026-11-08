// Cliente HTTP único: agrega el JWT a cada petición y normaliza los errores.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "reservas_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// FastAPI devuelve `detail` como texto (errores de negocio) o como lista (validación 422)
function extraerMensaje(data) {
  if (!data || !data.detail) return "Ocurrió un error inesperado";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`)
      .join(" | ");
  }
  return "Datos inválidos";
}

export async function request(path, { method = "GET", body, params } = {}) {
  const url = new URL(BASE_URL + path, window.location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) url.searchParams.set(k, v);
  });

  const headers = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // Token vencido o inválido: avisamos para cerrar la sesión
    if (res.status === 401 && token) window.dispatchEvent(new Event("auth:expired"));
    throw new ApiError(extraerMensaje(data), res.status);
  }
  return data;
}
