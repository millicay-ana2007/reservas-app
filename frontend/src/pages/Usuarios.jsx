import { useCallback, useEffect, useState } from "react";
import { usuariosApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { rules, validate } from "../utils/validators";

function UsuarioForm({ usuario, onSaved, onCancel }) {
  const editando = Boolean(usuario);
  const [values, setValues] = useState({
    nombre: usuario?.nombre ?? "",
    email: usuario?.email ?? "",
    rol: usuario?.rol ?? "cliente",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [errorServidor, setErrorServidor] = useState("");

  // Al editar, la contraseña es opcional: vacía significa "no cambiar"
  const esquema = {
    nombre: [rules.required("Ingresá el nombre"), rules.minLength(2), rules.maxLength(100)],
    email: [rules.required("Ingresá el email"), rules.email()],
    password: editando && !values.password
      ? []
      : [rules.required("Ingresá una contraseña"), rules.minLength(8), rules.password()],
  };

  const cambiar = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    const errs = validate(values, esquema);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const payload = { ...values, nombre: values.nombre.trim(), password: values.password || null };
    try {
      if (editando) await usuariosApi.actualizar(usuario.id, payload);
      else await usuariosApi.crear(payload);
      onSaved();
    } catch (err) {
      setErrorServidor(err.message);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="form">
      <Field label="Nombre completo" error={errors.nombre}>
        <input name="nombre" value={values.nombre} onChange={cambiar} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input type="email" name="email" value={values.email} onChange={cambiar} />
      </Field>
      <Field label="Rol">
        <select name="rol" value={values.rol} onChange={cambiar}>
          <option value="cliente">Cliente</option>
          <option value="admin">Administrador</option>
        </select>
      </Field>
      <Field
        label={editando ? "Nueva contraseña" : "Contraseña"}
        error={errors.password}
        hint={editando ? "Dejala vacía para mantener la actual" : "Mínimo 8 caracteres, con letras y números"}
      >
        <input type="password" name="password" value={values.password} onChange={cambiar} autoComplete="new-password" />
      </Field>
      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}

export default function Usuarios() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setRows(await usuariosApi.listar());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(u) {
    if (!window.confirm(`¿Eliminar al usuario ${u.nombre}?`)) return;
    try {
      await usuariosApi.eliminar(u.id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const columnas = [
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "rol", label: "Rol", render: (u) => (u.rol === "admin" ? "Administrador" : "Cliente") },
    {
      key: "acciones",
      label: "Acciones",
      render: (u) => (
        <div className="row-actions">
          <button className="link" onClick={() => setModal({ usuario: u })}>Editar</button>
          {u.id !== user.id && <button className="link link-danger" onClick={() => eliminar(u)}>Eliminar</button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>Usuarios</h1>
          <p>Cuentas de clientes y administradores.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ usuario: null })}>Nuevo usuario</button>
      </header>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="panel">
        <DataTable columns={columnas} rows={rows} loading={cargando} empty="No hay usuarios cargados." />
      </section>
      {modal && (
        <Modal title={modal.usuario ? "Editar usuario" : "Nuevo usuario"} onClose={() => setModal(null)}>
          <UsuarioForm usuario={modal.usuario} onCancel={() => setModal(null)}
            onSaved={() => { setModal(null); cargar(); }} />
        </Modal>
      )}
    </>
  );
}
