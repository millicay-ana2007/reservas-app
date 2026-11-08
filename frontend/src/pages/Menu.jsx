import { useCallback, useEffect, useState } from "react";
import { platosApi, restaurantesApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { formatMoneda, rules, validate } from "../utils/validators";

const ESQUEMA = {
  restaurante_id: [rules.required("Elegí el restaurante")],
  nombre: [rules.required("Ingresá el nombre del plato"), rules.minLength(2), rules.maxLength(100)],
  descripcion: [rules.maxLength(255)],
  precio: [rules.required("Ingresá el precio"), rules.monto()],
};

function PlatoForm({ plato, restaurantes, restauranteInicial, onSaved, onCancel }) {
  const [values, setValues] = useState({
    restaurante_id: String(plato?.restaurante_id ?? restauranteInicial ?? ""),
    nombre: plato?.nombre ?? "",
    descripcion: plato?.descripcion ?? "",
    precio: plato ? String(plato.precio) : "",
    disponible: plato?.disponible ?? true,
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
      ...values,
      restaurante_id: Number(values.restaurante_id),
      precio: Number(String(values.precio).trim().replace(",", ".")),
    };
    try {
      if (plato) await platosApi.actualizar(plato.id, payload);
      else await platosApi.crear(payload);
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
      <Field label="Nombre del plato" error={errors.nombre}>
        <input name="nombre" value={values.nombre} onChange={cambiar} />
      </Field>
      <Field label="Descripción (opcional)" error={errors.descripcion}>
        <input name="descripcion" value={values.descripcion} onChange={cambiar} />
      </Field>
      <Field label="Precio ($)" error={errors.precio}>
        <input type="text" inputMode="decimal" name="precio" placeholder="Ej: 8500" value={values.precio} onChange={cambiar} />
      </Field>
      <label className="check">
        <input type="checkbox" name="disponible" checked={values.disponible} onChange={cambiar} />
        Disponible para pedir
      </label>
      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary">Guardar</button>
      </div>
    </form>
  );
}

// Menú de los restaurantes: el administrador lo gestiona; el cliente solo lo consulta.
export default function Menu() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  const [restauranteId, setRestauranteId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    restaurantesApi.listar({ solo_activos: !isAdmin }).then(setRestaurantes).catch((e) => setError(e.message));
  }, [isAdmin]);

  const cargar = useCallback(async () => {
    try {
      setRows(await platosApi.listar({ restaurante_id: restauranteId }));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [restauranteId]);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}" del menú?`)) return;
    try {
      await platosApi.eliminar(p.id);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const columnas = [
    {
      key: "nombre", label: "Plato",
      render: (p) => (<><div>{p.nombre}</div>{p.descripcion && <div className="cell-sub">{p.descripcion}</div>}</>),
    },
    { key: "restaurante", label: "Restaurante" },
    { key: "precio", label: "Precio", align: "right", render: (p) => formatMoneda(p.precio) },
    ...(isAdmin ? [
      { key: "disponible", label: "Estado", render: (p) => (p.disponible ? "Disponible" : "No disponible") },
      {
        key: "acciones", label: "Acciones",
        render: (p) => (
          <div className="row-actions">
            <button className="link" onClick={() => setModal({ plato: p })}>Editar</button>
            <button className="link link-danger" onClick={() => eliminar(p)}>Eliminar</button>
          </div>
        ),
      },
    ] : []),
  ];

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>Menú</h1>
          <p>{isAdmin ? "Platos y precios de cada restaurante." : "Platos y precios. Podés elegir tu comida al hacer una reserva."}</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setModal({ plato: null })}>Nuevo plato</button>}
      </header>

      <div className="toolbar">
        <label className="inline-field">
          Restaurante
          <select value={restauranteId} onChange={(e) => setRestauranteId(e.target.value)}>
            <option value="">Todos</option>
            {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="panel">
        <DataTable columns={columnas} rows={rows} loading={cargando} empty="Todavía no hay platos cargados." />
      </section>

      {modal && (
        <Modal title={modal.plato ? "Editar plato" : "Nuevo plato"} onClose={() => setModal(null)}>
          <PlatoForm plato={modal.plato} restaurantes={restaurantes} restauranteInicial={restauranteId}
            onCancel={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />
        </Modal>
      )}
    </>
  );
}
