// Validaciones del lado del cliente. Replican las reglas del backend (Pydantic)
// para dar feedback inmediato; el servidor igualmente vuelve a validar todo.
export const hoyISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const rules = {
  required: (msg = "Campo obligatorio") => (v) => (String(v ?? "").trim() ? null : msg),
  email: () => (v) => (EMAIL_RE.test(v || "") ? null : "Ingresá un email válido"),
  minLength: (n) => (v) => ((v || "").length >= n ? null : `Mínimo ${n} caracteres`),
  maxLength: (n) => (v) => ((v || "").length <= n ? null : `Máximo ${n} caracteres`),
  password: () => (v) =>
    /[A-Za-z]/.test(v || "") && /\d/.test(v || "") ? null : "Debe incluir letras y números",
  phone: () => (v) =>
    /^[0-9+\-\s()]{6,30}$/.test(v || "") ? null : "Teléfono inválido (números, +, -, espacios)",
  intRange: (min, max) => (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? null : `Ingresá un entero entre ${min} y ${max}`;
  },
  // Monto en pesos: número mayor a 0 con hasta 2 decimales (acepta coma o punto)
  monto: () => (v) => {
    const texto = String(v ?? "").trim();
    return /^\d{1,8}([.,]\d{1,2})?$/.test(texto) && Number(texto.replace(",", ".")) > 0
      ? null
      : "Ingresá un monto mayor a 0 (hasta 2 decimales)";
  },
  notPast: () => (v) => (v && v >= hoyISO() ? null : "La fecha no puede ser anterior a hoy"),
  equalTo: (otro, msg) => (v, todos) => (v === todos[otro] ? null : msg),
};

// Recorre el esquema {campo: [reglas]} y devuelve {campo: primerError}
export function validate(values, schema) {
  const errors = {};
  for (const [campo, reglas] of Object.entries(schema)) {
    for (const regla of reglas) {
      const error = regla(values[campo], values);
      if (error) {
        errors[campo] = error;
        break;
      }
    }
  }
  return errors;
}

export const formatFecha = (iso) => (iso ? iso.split("-").reverse().join("/") : "");

// Pesos argentinos, p. ej. $ 4.500,00 (se cambia el espacio especial por uno común para PDF/Excel)
export const formatMoneda = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
    .format(Number(n) || 0)
    .replace(/\u00a0/g, " ");

export const MEDIOS_PAGO = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
};

// Cuándo quiere recibir la comida el cliente, respecto de su ingreso al local
export const SERVICIOS = {
  al_entrar: { titulo: "En el momento que entró al restaurante", corto: "Al entrar" },
  min_10: { titulo: "10 minutos después de entrar al restaurante", corto: "10 min después de entrar" },
  min_20: { titulo: "20 minutos después de entrar al restaurante", corto: "20 min después de entrar" },
  personalizado: { titulo: "Personalizado", corto: "Personalizado" },
};

export const servicioCorto = (r) =>
  !r.momento_servicio
    ? "A criterio del anfitrión"
    : r.momento_servicio === "personalizado"
      ? `A las ${r.hora_servicio}`
      : SERVICIOS[r.momento_servicio].corto;
