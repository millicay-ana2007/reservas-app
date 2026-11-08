import { useEffect, useState } from "react";
import { mesasApi, platosApi, reservasApi, restaurantesApi } from "../api/endpoints";
import Field from "../components/Field";
import MenuSelector from "../components/MenuSelector";
import { itemsDe } from "../utils/pedido";
import { hoyISO, rules, validate } from "../utils/validators";

// Franjas de 30 minutos entre 12:00 y 23:30 (mismo rango que valida el backend)
const HORAS = Array.from({ length: 24 }, (_, i) => {
  const h = 12 + Math.floor(i / 2);
  return `${String(h).padStart(2, "0")}:${i % 2 ? "30" : "00"}`;
});

const ESQUEMA = {
  restaurante_id: [rules.required("Elegí un restaurante")],
  fecha: [rules.required("Elegí una fecha"), rules.notPast()],
  hora: [rules.required("Elegí un horario")],
  personas: [rules.required("Indicá cuántas personas"), rules.intRange(1, 20)],
};

export default function ReservaForm({ reserva, onSaved, onCancel }) {
  const editando = Boolean(reserva);
  const [restaurantes, setRestaurantes] = useState([]);
  const [values, setValues] = useState({
    restaurante_id: reserva ? String(reserva.restaurante_id) : "",
    fecha: reserva?.fecha ?? hoyISO(),
    hora: reserva?.hora ?? "21:00",
    personas: reserva ? String(reserva.cantidad_personas) : "2",
  });
  const [mesaId, setMesaId] = useState(reserva?.mesa_id ?? null);
  const [disponibles, setDisponibles] = useState(null); // null = todavía no se consultó
  const [errors, setErrors] = useState({});
  const [errorServidor, setErrorServidor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [platos, setPlatos] = useState([]);       // menú del restaurante elegido
  const [cantidades, setCantidades] = useState({}); // {plato_id: cantidad}

  // Al elegir restaurante se carga su menú (solo en reservas nuevas)
  useEffect(() => {
    if (editando || !values.restaurante_id) {
      setPlatos([]);
      return;
    }
    let vigente = true;
    platosApi
      .listar({ restaurante_id: values.restaurante_id, solo_disponibles: true })
      .then((lista) => {
        if (!vigente) return;
        setPlatos(lista);
        setCantidades({});
      })
      .catch((e) => vigente && setErrorServidor(e.message));
    return () => {
      vigente = false;
    };
  }, [values.restaurante_id, editando]);

  useEffect(() => {
    restaurantesApi.listar({ solo_activos: true }).then(setRestaurantes).catch((e) => setErrorServidor(e.message));
  }, []);

  // Cada vez que cambian los datos de la reserva, consultamos qué mesas están libres
  useEffect(() => {
    const errs = validate(values, ESQUEMA);
    if (Object.keys(errs).length) {
      setDisponibles(null);
      return;
    }
    let vigente = true;
    mesasApi
      .disponibles({
        restaurante_id: values.restaurante_id,
        fecha: values.fecha,
        hora: values.hora,
        personas: values.personas,
        excluir_reserva: reserva?.id ?? 0,
      })
      .then((lista) => {
        if (!vigente) return;
        setDisponibles(lista);
        setMesaId((actual) => (lista.some((m) => m.id === actual) ? actual : null));
      })
      .catch((e) => vigente && setErrorServidor(e.message));
    return () => {
      vigente = false;
    };
  }, [values, reserva]);

  const cambiar = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErrorServidor("");
    const errs = validate(values, ESQUEMA);
    if (!mesaId) errs.mesa = "Elegí una de las mesas disponibles";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      mesa_id: mesaId,
      fecha: values.fecha,
      hora: values.hora,
      cantidad_personas: Number(values.personas),
    };
    setEnviando(true);
    try {
      if (editando) {
        await reservasApi.modificar(reserva.id, payload);
        onSaved();
      } else {
        const creada = await reservasApi.crear({ ...payload, items: itemsDe(cantidades) });
        onSaved(creada);
      }
    } catch (err) {
      setErrorServidor(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="form">
      <Field label="Restaurante" error={errors.restaurante_id}>
        <select name="restaurante_id" value={values.restaurante_id} onChange={cambiar}>
          <option value="">Elegí un restaurante</option>
          {restaurantes.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      </Field>

      <div className="form-row">
        <Field label="Fecha" error={errors.fecha}>
          <input type="date" name="fecha" min={hoyISO()} value={values.fecha} onChange={cambiar} />
        </Field>
        <Field label="Horario" error={errors.hora}>
          <select name="hora" value={values.hora} onChange={cambiar}>
            {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
        <Field label="Personas" error={errors.personas}>
          <input type="number" name="personas" min="1" max="20" value={values.personas} onChange={cambiar} />
        </Field>
      </div>

      <div className="field">
        <span className="field-label">Mesa</span>
        {disponibles === null && <p className="field-hint">Completá restaurante, fecha, horario y personas para ver las mesas libres.</p>}
        {disponibles && disponibles.length === 0 && (
          <p className="field-hint">No hay mesas libres en ese horario. Probá con otro horario o con menos personas.</p>
        )}
        {disponibles && disponibles.length > 0 && (
          <div className="mesas-grid" role="radiogroup" aria-label="Mesas disponibles">
            {disponibles.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mesaId === m.id}
                className={mesaId === m.id ? "mesa mesa-sel" : "mesa"}
                onClick={() => setMesaId(m.id)}
              >
                <span className="mesa-num">Mesa {m.numero}</span>
                <span className="mesa-seats" aria-hidden="true">
                  {Array.from({ length: m.capacidad }, (_, i) => <i key={i} />)}
                </span>
                <span className="mesa-cap">{m.capacidad} lugares</span>
              </button>
            ))}
          </div>
        )}
        {errors.mesa && <span className="field-error" role="alert">{errors.mesa}</span>}
      </div>

      {!editando && values.restaurante_id && (
        <div className="field">
          <span className="field-label">Menú del restaurante</span>
          <span className="field-hint">Opcional: elegí qué vas a comer y mirá cuánto vas a pagar.</span>
          <MenuSelector platos={platos} cantidades={cantidades} onChange={setCantidades}
            vacio="Este restaurante todavía no cargó su menú." />
        </div>
      )}

      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Confirmar reserva"}
        </button>
      </div>
    </form>
  );
}
