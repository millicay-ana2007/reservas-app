import { request } from "./client";

export const authApi = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (nombre, email, password) =>
    request("/auth/register", { method: "POST", body: { nombre, email, password } }),
};

export const usuariosApi = {
  listar: () => request("/usuarios"),
  crear: (d) => request("/usuarios", { method: "POST", body: d }),
  actualizar: (id, d) => request(`/usuarios/${id}`, { method: "PUT", body: d }),
  eliminar: (id) => request(`/usuarios/${id}`, { method: "DELETE" }),
};

export const restaurantesApi = {
  listar: (params) => request("/restaurantes", { params }),
  crear: (d) => request("/restaurantes", { method: "POST", body: d }),
  actualizar: (id, d) => request(`/restaurantes/${id}`, { method: "PUT", body: d }),
  eliminar: (id) => request(`/restaurantes/${id}`, { method: "DELETE" }),
};

export const mesasApi = {
  listar: (params) => request("/mesas", { params }),
  disponibles: (params) => request("/mesas/disponibles", { params }),
  estado: (params) => request("/mesas/estado", { params }),
  crear: (d) => request("/mesas", { method: "POST", body: d }),
  actualizar: (id, d) => request(`/mesas/${id}`, { method: "PUT", body: d }),
  eliminar: (id) => request(`/mesas/${id}`, { method: "DELETE" }),
};

export const platosApi = {
  listar: (params) => request("/platos", { params }),
  crear: (d) => request("/platos", { method: "POST", body: d }),
  actualizar: (id, d) => request(`/platos/${id}`, { method: "PUT", body: d }),
  eliminar: (id) => request(`/platos/${id}`, { method: "DELETE" }),
};

export const reservasApi = {
  listar: (params) => request("/reservas", { params }),
  crear: (d) => request("/reservas", { method: "POST", body: d }),
  modificar: (id, d) => request(`/reservas/${id}`, { method: "PUT", body: d }),
  cambiarEstado: (id, estado) => request(`/reservas/${id}/estado`, { method: "PATCH", body: { estado } }),
  registrarLlegada: (id) => request(`/reservas/${id}/llegada`, { method: "PATCH" }),
  cobrar: (id, d) => request(`/reservas/${id}/cobro`, { method: "POST", body: d }),
  pedido: (id) => request(`/reservas/${id}/pedido`),
  guardarPedido: (id, items) => request(`/reservas/${id}/pedido`, { method: "PUT", body: { items } }),
  elegirServicio: (id, d) => request(`/reservas/${id}/servicio`, { method: "PATCH", body: d }),
  eliminar: (id) => request(`/reservas/${id}`, { method: "DELETE" }),
};

export const pedidosApi = {
  hoy: () => request("/pedidos/hoy"),
};

export const pagosApi = {
  listar: () => request("/pagos"),
};

export const reportesApi = {
  resumen: () => request("/reportes/resumen"),
  porRestaurante: () => request("/reportes/por-restaurante"),
  clientesFrecuentes: () => request("/reportes/clientes-frecuentes"),
  porFranja: () => request("/reportes/por-franja"),
  ingresosPorMedio: () => request("/reportes/ingresos-por-medio"),
};
