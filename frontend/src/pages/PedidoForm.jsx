import { useEffect, useState } from "react";
import { platosApi, reservasApi } from "../api/endpoints";
import MenuSelector from "../components/MenuSelector";
import { cantidadesDe, itemsDe } from "../utils/pedido";

// Agregar o cambiar la comida de una reserva existente (el cliente antes de llegar,
// el administrador también cuando el cliente ya está en la mesa y pide algo más).
export default function PedidoForm({ reserva, onSaved, onCancel }) {
  const [platos, setPlatos] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [cargando, setCargando] = useState(true);
  const [errorServidor, setErrorServidor] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    Promise.all([
      platosApi.listar({ restaurante_id: reserva.restaurante_id, solo_disponibles: true }),
      reservasApi.pedido(reserva.id),
    ])
      .then(([lista, pedido]) => {
        setPlatos(lista);
        setCantidades(cantidadesDe(pedido.items));
      })
      .catch((e) => setErrorServidor(e.message))
      .finally(() => setCargando(false));
  }, [reserva]);

  async function guardar(e) {
    e.preventDefault();
    setErrorServidor("");
    setEnviando(true);
    try {
      await reservasApi.guardarPedido(reserva.id, itemsDe(cantidades));
      onSaved();
    } catch (err) {
      setErrorServidor(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="form">
      <p className="field-hint">
        {reserva.cliente} · {reserva.restaurante} · Mesa {reserva.mesa_numero}
      </p>
      {cargando ? (
        <p className="state-msg">Cargando menú…</p>
      ) : (
        <MenuSelector platos={platos} cantidades={cantidades} onChange={setCantidades}
          vacio="Este restaurante todavía no tiene platos cargados en el menú." />
      )}
      {errorServidor && <div className="alert alert-error" role="alert">{errorServidor}</div>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost-dark" onClick={onCancel}>Volver</button>
        <button type="submit" className="btn btn-primary" disabled={enviando || cargando}>
          {enviando ? "Guardando…" : "Guardar pedido"}
        </button>
      </div>
    </form>
  );
}
