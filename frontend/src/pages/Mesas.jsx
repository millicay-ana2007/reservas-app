import { useCallback, useEffect, useState } from "react";
import { mesasApi, restaurantesApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { rules, validate } from "../utils/validators";

const ESQUEMA = {
  restaurante_id: [rules.required("Elegí un restaurante")],
  numero: [rules.required("Ingresá el número"), rules.intRange(1, 999)],
  capacidad: [rules.required("Ingresá la capacidad"), rules.intRange(1, 20)],
};

function MesaForm({ mesa, restaurantes, restauranteInicial, onSaved, onCancel }) {
  const [values, setValues] = useState({
    restaurante_id: String(mesa?.restaurante_id ?? restauranteInicial ?? ""),
    numero: String(mesa?.numero ?? ""),
    capacidad: String(mesa?.capacidad ?? ""),
    activa: mesa?.activa ?? true,
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
    const payload = {
      restaurante_id: Number(values.restaurante_id),
      numero: Number(values.numero),
      capacidad: Number(values.capacidad),
      activa: values.activa,
    };
    try {
      if (mesa) await mesasApi.actualizar(mesa.id, payload);
      else await mesasApi.crear(payload);
      onSaved();
    } catch (err) {
      setErrorServidor(err.message);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="form">
      <Field label="Restaurante" error={errors.restaurante_id}>
        <select name="restaurante_id" value={values.restaurante_id} onChange={cambiar}>
          <option value="">Elegí un restaurante</option>
          {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </Field>
      <div className="form-row">
        <Field label="Número de mesa" error={errors.numero}>
          <input type="number" name="numero" min="1" value={values.numero} onChange={cambiar} />
        </Field>
        <Field label="Capacidad" error={errors.capacidad} hint="Entre 1 y 20 lugares">
          <input type="number" name="capacidad" min="1" max="20" value={values.capacidad} onChange={cambiar} />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" name="activa" checked={values.activa} onChange={cambiar} />
        Disponible para reservar
      </label>
      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}

export default function Mesas() {
  const [rows, setRows] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    restaurantesApi.listar().then(setRestaurantes).catch((e) => setError(e.message));
  }, []);

  const cargar = useCallback(async () => {
    try {
      setRows(await mesasApi.listar({ restaurante_id: filtro }));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(m) {
    if (!window.confirm(`¿Eliminar la mesa ${m.numero} de ${m.restaurante}?`)) return;
    try {
      await mesasApi.eliminar(m.id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const columnas = [
    { key: "restaurante", label: "Restaurante" },
    { key: "numero", label: "Mesa", render: (m) => `Mesa ${m.numero}` },
    { key: "capacidad", label: "Capacidad", align: "right", render: (m) => `${m.capacidad} lugares` },
    { key: "activa", label: "Estado", render: (m) => (m.activa ? "Disponible" : "Fuera de servicio") },
    {
      key: "acciones",
      label: "Acciones",
      render: (m) => (
        <div className="row-actions">
          <button className="link" onClick={() => setModal({ mesa: m })}>Editar</button>
          <button className="link link-danger" onClick={() => eliminar(m)}>Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>Mesas</h1>
          <p>Mesas de cada restaurante y su capacidad.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ mesa: null })}>Nueva mesa</button>
      </header>
      <div className="toolbar">
        <label className="inline-field">
          Restaurante
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todos</option>
            {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="panel">
        <DataTable columns={columnas} rows={rows} loading={cargando} empty="No hay mesas cargadas para este filtro." />
      </section>
      {modal && (
        <Modal title={modal.mesa ? "Editar mesa" : "Nueva mesa"} onClose={() => setModal(null)}>
          <MesaForm mesa={modal.mesa} restaurantes={restaurantes} restauranteInicial={filtro}
            onCancel={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />
        </Modal>
      )}
    </>
  );
}
