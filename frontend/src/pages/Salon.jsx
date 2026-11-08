import { useCallback, useEffect, useState } from "react";
import { mesasApi, reservasApi, restaurantesApi } from "../api/endpoints";
import Modal from "../components/Modal";
import CobroForm from "./CobroForm";

const ETIQUETAS = {
  libre: "Libre",
  ocupada: "Ocupada",
  reservada: "Reservada",
  fuera_de_servicio: "Fuera de servicio",
};

// Estado de cada mesa en este momento. Se actualiza solo cada 15 segundos.
export default function Salon() {
  const [mesas, setMesas] = useState([]);
  const [restaurantes, setRestaurantes] = useState([]);
  const [restauranteId, setRestauranteId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cobro, setCobro] = useState(null); // null | datos de la reserva a cobrar
  const [actualizado, setActualizado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setMesas(await mesasApi.estado({ restaurante_id: restauranteId }));
      setError("");
      setActualizado(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [restauranteId]);

  useEffect(() => {
    restaurantesApi.listar().then(setRestaurantes).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setCargando(true);
    cargar();
    const timer = setInterval(cargar, 15000);
    return () => clearInterval(timer);
  }, [cargar]);

  async function registrarLlegada(m) {
    setAviso("");
    try {
      await reservasApi.registrarLlegada(m.proxima_reserva_id);
      setAviso(`Ingresó ${m.proxima_cliente}: la Mesa ${m.numero} quedó ocupada`);
      setError("");
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const contar = (estado) => mesas.filter((m) => m.estado === estado).length;

  const grupos = {};
  mesas.forEach((m) => {
    if (!grupos[m.restaurante]) grupos[m.restaurante] = [];
    grupos[m.restaurante].push(m);
  });

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>Mesas en vivo</h1>
          <p>Qué mesas están libres, reservadas u ocupadas ahora mismo.</p>
        </div>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <label className="inline-field">
            Restaurante
            <select value={restauranteId} onChange={(e) => setRestauranteId(e.target.value)}>
              <option value="">Todos</option>
              {restaurantes.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost-dark" onClick={cargar}>Actualizar</button>
        </div>
      </header>

      <section className="stats" aria-label="Resumen de mesas">
        <div className="stat"><strong>{contar("libre")}</strong><span>libres</span></div>
        <div className="stat"><strong>{contar("ocupada")}</strong><span>ocupadas</span></div>
        <div className="stat"><strong>{contar("reservada")}</strong><span>con reserva para hoy</span></div>
      </section>

      {actualizado && (
        <p className="field-hint" style={{ marginBottom: "1rem" }}>
          Actualizado a las {actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      {aviso && <div className="alert alert-ok" role="status">{aviso}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {cargando && <p className="state-msg">Cargando mesas…</p>}
      {!cargando && mesas.length === 0 && <p className="state-msg">No hay mesas para mostrar.</p>}

      {Object.entries(grupos).map(([nombre, lista]) => (
        <section className="panel" key={nombre}>
          <h2>{nombre}</h2>
          <ul className="salon-grid">
            {lista.map((m) => (
              <li key={m.id} className={`salon-mesa salon-${m.estado}`}>
                <div className="salon-head">
                  <strong>Mesa {m.numero}</strong>
                  <span className="salon-cap">{m.capacidad} lugares</span>
                </div>
                <span className="salon-estado">{ETIQUETAS[m.estado]}</span>

                {m.estado === "ocupada" && (
                  <>
                    <p className="salon-info">{m.cliente}, {m.personas} personas, desde las {m.desde}</p>
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() =>
                        setCobro({ id: m.reserva_id, cliente: m.cliente, mesa_numero: m.numero, restaurante: m.restaurante })
                      }
                    >
                      Cobrar y liberar
                    </button>
                  </>
                )}

                {m.estado === "reservada" && (
                  <>
                    <p className="salon-info">{m.proxima_cliente} a las {m.proxima_hora}</p>
                    <button className="btn btn-ghost-dark btn-small" onClick={() => registrarLlegada(m)}>
                      Llegó el cliente
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {cobro && (
        <Modal title="Cobrar y liberar la mesa" onClose={() => setCobro(null)}>
          <CobroForm
            reserva={cobro}
            onCancel={() => setCobro(null)}
            onSaved={() => {
              setAviso(`Cobro registrado: la Mesa ${cobro.mesa_numero} quedó libre`);
              setCobro(null);
              cargar();
            }}
          />
        </Modal>
      )}
    </>
  );
}
