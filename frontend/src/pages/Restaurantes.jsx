import { useCallback, useEffect, useState } from "react";
import { restaurantesApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { rules, validate } from "../utils/validators";

const ESQUEMA = {
  nombre: [rules.required("Ingresá el nombre"), rules.minLength(2), rules.maxLength(120)],
  direccion: [rules.required("Ingresá la dirección"), rules.minLength(3), rules.maxLength(200)],
  telefono: [rules.required("Ingresá el teléfono"), rules.phone()],
};

function RestauranteForm({ restaurante, onSaved, onCancel }) {
  const [values, setValues] = useState({
    nombre: restaurante?.nombre ?? "",
    direccion: restaurante?.direccion ?? "",
    telefono: restaurante?.telefono ?? "",
    activo: restaurante?.activo ?? true,
  });
  const [errors, setErrors] = useState({});
  const [errorServidor, setErrorServidor] = useState("");

  const cambiar = (e) =>
    setValues({ ...values, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function enviar(e) {
    e.preventDefault();
    const errs = validate(values, ESQUEMA);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      if (restaurante) await restaurantesApi.actualizar(restaurante.id, values);
      else await restaurantesApi.crear(values);
      onSaved();
    } catch (err) {
      setErrorServidor(err.message);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="form">
      <Field label="Nombre" error={errors.nombre}>
        <input name="nombre" value={values.nombre} onChange={cambiar} />
      </Field>
      <Field label="Dirección" error={errors.direccion}>
        <input name="direccion" value={values.direccion} onChange={cambiar} />
      </Field>
      <Field label="Teléfono" error={errors.telefono}>
        <input name="telefono" value={values.telefono} onChange={cambiar} />
      </Field>
      <label className="check">
        <input type="checkbox" name="activo" checked={values.activo} onChange={cambiar} />
        Recibe reservas
      </label>
      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}

export default function Restaurantes() {
  const [rows, setRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setRows(await restaurantesApi.listar());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar "${r.nombre}" y todas sus mesas?`)) return;
    try {
      await restaurantesApi.eliminar(r.id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const columnas = [
    { key: "nombre", label: "Nombre" },
    { key: "direccion", label: "Dirección" },
    { key: "telefono", label: "Teléfono" },
    { key: "activo", label: "Estado", render: (r) => (r.activo ? "Recibe reservas" : "Inactivo") },
    {
      key: "acciones",
      label: "Acciones",
      render: (r) => (
        <div className="row-actions">
          <button className="link" onClick={() => setModal({ restaurante: r })}>Editar</button>
          <button className="link link-danger" onClick={() => eliminar(r)}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>Restaurantes</h1>
          <p>Locales que reciben reservas.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ restaurante: null })}>Nuevo restaurante</button>
      </header>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="panel">
        <DataTable columns={columnas} rows={rows} loading={cargando} empty="Todavía no cargaste restaurantes." />
      </section>
      {modal && (
        <Modal title={modal.restaurante ? "Editar restaurante" : "Nuevo restaurante"} onClose={() => setModal(null)}>
          <RestauranteForm restaurante={modal.restaurante} onCancel={() => setModal(null)}
            onSaved={() => { setModal(null); cargar(); }} />
        </Modal>
      )}
    </>
  );
}
