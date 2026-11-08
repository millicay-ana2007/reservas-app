import { useState } from "react";
import { reservasApi } from "../api/endpoints";
import { SERVICIOS, formatFecha, formatMoneda, servicioCorto } from "../utils/validators";

const OPCIONES = ["al_entrar", "min_10", "min_20", "personalizado"];

// Carteles que ve el cliente después de reservar:
//   sin comida  -> "Reservado con éxito / Lo estaremos esperando"
//   con comida  -> "Reservado con éxito" + elegir cuándo recibir la comida -> "Finalizado con éxito"
export default function ReservaExito({ reserva, onClose }) {
  const conPedido = reserva.total_pedido > 0;
  const [paso, setPaso] = useState(conPedido ? "servicio" : "final");
  const [reservaFinal, setReservaFinal] = useState(reserva);
  const [momento, setMomento] = useState(null);
  const [hora, setHora] = useState(reserva.hora);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setError("");
    if (!momento) return setError("Elegí una opción o tocá “Que decida el anfitrión”");
    if (momento === "personalizado" && (!hora || hora < reserva.hora)) {
      return setError(`Elegí una hora desde las ${reserva.hora} (la de tu reserva) en adelante`);
    }
    setEnviando(true);
    try {
      const actualizada = await reservasApi.elegirServicio(reserva.id, {
        momento,
        hora: momento === "personalizado" ? hora : null,
      });
      setReservaFinal(actualizada);
      setPaso("final");
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const detalle = `${reserva.restaurante} · Mesa ${reserva.mesa_numero} · ${formatFecha(reserva.fecha)} a las ${reserva.hora}`;

  return (
    <div className="exito-backdrop">
      <div className="exito" role="dialog" aria-modal="true" aria-labelledby="exito-titulo">
        <div className="exito-icon" aria-hidden="true">✓</div>

        {paso === "servicio" && (
          <>
            <h2 id="exito-titulo">Reservado con éxito</h2>
            <p className="exito-sub">Su comida será servida en el horario que el anfitrión decida</p>
            <p className="exito-detalle">{detalle}</p>
            <div className="exito-total">
              <span>Total a pagar</span>
              <strong>{formatMoneda(reserva.total_pedido)}</strong>
            </div>

            <p className="exito-pregunta">¿Cuándo querés recibir tu comida?</p>
            <div className="servicio-opciones" role="radiogroup" aria-label="Horario de servicio">
              {OPCIONES.map((op) => (
                <button key={op} type="button" role="radio" aria-checked={momento === op}
                  className="servicio-op" onClick={() => setMomento(op)}>
                  {SERVICIOS[op].titulo}
                </button>
              ))}
            </div>

            {momento === "personalizado" && (
              <label className="field exito-hora">
                <span className="field-label">¿A qué hora querés recibirla?</span>
                <input type="time" value={hora} min={reserva.hora} onChange={(e) => setHora(e.target.value)} />
              </label>
            )}

            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <div className="exito-acciones">
              <button type="button" className="btn btn-ghost-dark" onClick={() => setPaso("final")}>
                Que decida el anfitrión
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmar} disabled={enviando}>
                {enviando ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </>
        )}

        {paso === "final" && (
          <>
            <h2 id="exito-titulo">{conPedido ? "Finalizado con éxito" : "Reservado con éxito"}</h2>
            <p className="exito-sub">Lo estaremos esperando</p>
            <p className="exito-detalle">{detalle}</p>
            {conPedido && (
              <div className="exito-resumen">
                <div><span>Total a pagar</span><strong>{formatMoneda(reservaFinal.total_pedido)}</strong></div>
                <div><span>Comida</span><strong>{servicioCorto(reservaFinal)}</strong></div>
              </div>
            )}
            <div className="exito-acciones exito-acciones-uno">
              <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>Aceptar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
