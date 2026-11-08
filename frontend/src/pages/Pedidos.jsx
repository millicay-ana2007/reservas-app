import { useCallback, useEffect, useState } from "react";
import { pedidosApi, reservasApi } from "../api/endpoints";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { SERVICIOS, formatMoneda } from "../utils/validators";
import CobroForm from "./CobroForm";

// Qué comida hay que servir hoy, en qué mesa y a qué hora. Se actualiza sola cada 15 segundos.
function textoServicio(p) {
  if (p.servir_a) return { principal: `Servir a las ${p.servir_a}`, detalle: SERVICIOS[p.momento_servicio].titulo };
  if (p.momento_servicio) {
    return {
      principal: SERVICIOS[p.momento_servicio].titulo,
      detalle: "El cliente todavía no llegó: la hora exacta se calcula cuando marques “Llegó”",
    };
  }
  return { principal: "Sin horario elegido", detalle: "Lo decide el anfitrión" };
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cobro, setCobro] = useState(null);
  const [actualizado, setActualizado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await pedidosApi.hoy());
      setError("");
      setActualizado(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const timer = setInterval(cargar, 15000);
    return () => clearInterval(timer);
  }, [cargar]);

  async function registrarLlegada(p) {
    setAviso("");
    try {
      await reservasApi.registrarLlegada(p.reserva_id);
      setAviso(`Ingresó ${p.cliente}: la Mesa ${p.mesa_numero} quedó ocupada`);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>Pedidos de hoy</h1>
          <p>Qué comida servir, en qué mesa y a qué hora.</p>
        </div>
        {actualizado && (
          <span className="cell-sub">
            Actualizado {actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </header>

      {aviso && <div className="alert alert-ok" role="status">{aviso}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {cargando ? (
        <p className="state-msg">Cargando…</p>
      ) : pedidos.length === 0 ? (
        <section className="panel">
          <p className="state-msg">No hay pedidos de comida pendientes para hoy.</p>
        </section>
      ) : (
        <ul className="cocina-grid">
          {pedidos.map((p) => {
            const srv = textoServicio(p);
            return (
              <li key={p.reserva_id} className={p.estado === "en_curso" ? "cocina-card cocina-card-curso" : "cocina-card"}>
                <div className="cocina-head">
                  <div>
                    <strong>Mesa {p.mesa_numero}</strong>
                    <div className="cell-sub">{p.restaurante}</div>
                  </div>
                  <StatusBadge estado={p.estado} />
                </div>
                <div className="cell-sub">
                  {p.cliente} · {p.personas} {p.personas === 1 ? "persona" : "personas"} · reserva {p.hora}
                  {p.llegada ? ` · llegó ${p.llegada}` : ""}
                </div>

                <div className="cocina-servir">
                  <strong>{srv.principal}</strong>
                  <span>{srv.detalle}</span>
                </div>

                <ul className="cocina-items" aria-label="Platos del pedido">
                  {p.items.map((i) => (
                    <li key={i.nombre}><b>{i.cantidad}×</b> {i.nombre}</li>
                  ))}
                </ul>

                <div className="cocina-pie">
                  <span>Total <strong>{formatMoneda(p.total)}</strong></span>
                  {p.estado === "confirmada" ? (
                    <button className="btn btn-primary btn-small" onClick={() => registrarLlegada(p)}>Llegó</button>
                  ) : (
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() =>
                        setCobro({ id: p.reserva_id, cliente: p.cliente, mesa_numero: p.mesa_numero,
                                   restaurante: p.restaurante, total_pedido: p.total })
                      }
                    >
                      Cobrar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
