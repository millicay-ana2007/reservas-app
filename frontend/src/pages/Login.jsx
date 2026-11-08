import { useState } from "react";
import { Navigate } from "react-router-dom";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";
import { rules, validate } from "../utils/validators";

const ESQUEMA_LOGIN = {
  email: [rules.required("Ingresá tu email"), rules.email()],
  password: [rules.required("Ingresá tu contraseña")],
};
const ESQUEMA_REGISTRO = {
  nombre: [rules.required("Ingresá tu nombre"), rules.minLength(2), rules.maxLength(100)],
  email: [rules.required("Ingresá tu email"), rules.email()],
  password: [rules.required("Elegí una contraseña"), rules.minLength(8), rules.password()],
  confirmar: [rules.equalTo("password", "Las contraseñas no coinciden")],
};

export default function Login() {
  const { user, isAdmin, login, register } = useAuth();
  const [modo, setModo] = useState("login");
  const [values, setValues] = useState({ nombre: "", email: "", password: "", confirmar: "" });
  const [errors, setErrors] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (user) return <Navigate to={isAdmin ? "/dashboard" : "/reservas"} replace />;

  const cambiar = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErrorServidor("");
    const errs = validate(values, modo === "login" ? ESQUEMA_LOGIN : ESQUEMA_REGISTRO);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setEnviando(true);
    try {
      if (modo === "login") await login(values.email, values.password);
      else await register(values.nombre.trim(), values.email, values.password);
    } catch (err) {
      setErrorServidor(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <h1>Cada mesa, a su hora.</h1>
        <p>Reservá tu lugar en segundos y gestioná tus reservas sin llamadas ni esperas.</p>
      </section>

      <section className="login-panel">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={modo === "login"} className={modo === "login" ? "tab on" : "tab"}
            onClick={() => { setModo("login"); setErrors({}); setErrorServidor(""); }}>
            Ingresar
          </button>
          <button type="button" role="tab" aria-selected={modo === "registro"} className={modo === "registro" ? "tab on" : "tab"}
            onClick={() => { setModo("registro"); setErrors({}); setErrorServidor(""); }}>
            Crear cuenta
          </button>
        </div>

        <form onSubmit={enviar} noValidate className="form">
          {modo === "registro" && (
            <Field label="Nombre completo" error={errors.nombre}>
              <input name="nombre" value={values.nombre} onChange={cambiar} autoComplete="name" />
            </Field>
          )}
          <Field label="Email" error={errors.email}>
            <input name="email" type="email" value={values.email} onChange={cambiar} autoComplete="email" />
          </Field>
          <Field label="Contraseña" error={errors.password}
            hint={modo === "registro" ? "Mínimo 8 caracteres, con letras y números" : undefined}>
            <input name="password" type="password" value={values.password} onChange={cambiar}
              autoComplete={modo === "login" ? "current-password" : "new-password"} />
          </Field>
          {modo === "registro" && (
            <Field label="Repetir contraseña" error={errors.confirmar}>
              <input name="confirmar" type="password" value={values.confirmar} onChange={cambiar} autoComplete="new-password" />
            </Field>
          )}
          {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? "Un momento…" : modo === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
      </section>
    </div>
  );
}
