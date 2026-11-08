import { useCallback, useEffect, useState } from "react";
import { reservasApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { MEDIOS_PAGO, formatFecha, formatMoneda, hoyISO, servicioCorto } from "../utils/validators";
import CobroForm from "./CobroForm";
import PedidoForm from "./PedidoForm";
import ReservaExito from "./ReservaExito";
import ReservaForm from "./ReservaForm";

export default function Reservas() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState([]);
  const [filtros, setFiltros] = useState({ estado: "", fecha: "" });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState(null); // null | { reserva: obj|null }
  const [cobro, setCobro] = useState(null); // null | reserva que se va a cobrar
  const [pedido, setPedido] = useState(null); // null | reserva cuyo pedido de comida se edita
  const [exito, setExito] = useState(null); // null | reserva recién creada (cartel de éxito)

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setRows(await reservasApi.listar(filtros));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function ejecutar(accion, mensajeOk) {
    setAviso("");
    try {
      await accion();
      setAviso(mensajeOk);
      setError("");
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const cancelar = (r) =>
    window.confirm(`¿Cancelar la reserva de ${r.cliente} del ${formatFecha(r.fecha)} a las ${r.hora}?`) &&
    ejecutar(() => reservasApi.cambiarEstado(r.id, "cancelada"), "Reserva cancelada");
  const registrarLlegada = (r) =>
    ejecutar(() => reservasApi.registrarLlegada(r.id), `Ingresó ${r.cliente}: la Mesa ${r.mesa_numero} quedó ocupada`);
  const eliminar = (r) =>
    window.confirm("¿Eliminar definitivamente esta reserva?") &&
    ejecutar(() => reservasApi.eliminar(r.id), "Reserva eliminada");

  const columnas = [
    ...(isAdmin ? [{ key: "cliente", label: "Cliente" }] : []),
    { key: "restaurante", label: "Restaurante" },
    { key: "mesa_numero", label: "Mesa", render: (r) => `Mesa ${r.mesa_numero}` },
    { key: "fecha", label: "Fecha", render: (r) => formatFecha(r.fecha) },
    { key: "hora", label: "Hora" },
    { key: "cantidad_personas", label: "Personas", align: "right" },
    { key: "estado", label: "Estado", render: (r) => <StatusBadge estado={r.estado} /> },
    {
      key: "pedido",
      label: "Pedido",
      align: "right",
      render: (r) =>
        r.total_pedido > 0 ? (
          <>
            <div>{formatMoneda(r.total_pedido)}</div>
            <div className="cell-sub">{servicioCorto(r)}</div>
          </>
        ) : (
          "—"
        ),
    },
    {
      key: "ocupacion",
      label: "Ocupación",
      render: (r) => {
        if (r.estado === "en_curso") return `En la mesa desde las ${r.llegada}`;
        if (r.estado === "completada" && r.llegada) {
          return (
            <>
              <div>{r.llegada} a {r.salida}</div>
              {r.monto_pagado != null && (
                <div className="cell-sub">{formatMoneda(r.monto_pagado)} ({MEDIOS_PAGO[r.medio_pago] || r.medio_pago})</div>
              )}
            </>
          );
        }
        return "—";
      },
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (r) => (
        <div className="row-actions">
          {r.estado === "confirmada" && (
            <>
              <button className="link" onClick={() => setModal({ reserva: r })}>Modificar</button>
              <button className="link" onClick={() => cancelar(r)}>Cancelar</button>
              {isAdmin && r.fecha === hoyISO() && (
                <button className="link" onClick={() => registrarLlegada(r)}>Llegó</button>
              )}
            </>
          )}
          {(r.estado === "confirmada" || (isAdmin && r.estado === "en_curso")) && (
            <button className="link" onClick={() => setPedido(r)}>
              {r.total_pedido > 0 ? "Pedido" : "Pedir comida"}
            </button>
          )}
          {isAdmin && r.estado === "en_curso" && (
            <button className="link" onClick={() => setCobro(r)}>Cobrar</button>
          )}
          {isAdmin && <button className="link link-danger" onClick={() => eliminar(r)}>Eliminar</button>}
        </div>
      ),
    },
  ];

  return (
    <>
      <header className="page-header page-header-row">
        <div>
          <h1>{isAdmin ? "Reservas" : "Mis reservas"}</h1>
          <p>{isAdmin ? "Todas las reservas de los restaurantes." : "Tus reservas confirmadas y pasadas."}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ reserva: null })}>Nueva reserva</button>
      </header>

      <div className="toolbar">
        <label className="inline-field">
          Estado
          <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="confirmada">Confirmadas</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </label>
        <label className="inline-field">
          Fecha
          <input type="date" value={filtros.fecha} onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })} />
        </label>
        {(filtros.estado || filtros.fecha) && (
          <button className="link" onClick={() => setFiltros({ estado: "", fecha: "" })}>Quitar filtros</button>
        )}
      </div>

      {aviso && <div className="alert alert-ok" role="status">{aviso}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <section className="panel">
        <DataTable
          columns={columnas}
          rows={rows}
          loading={cargando}
          empty="No hay reservas con estos filtros. Creá una con “Nueva reserva”."
        />
      </section>

      {modal && (
        <Modal title={modal.reserva ? "Modificar reserva" : "Nueva reserva"} onClose={() => setModal(null)}>
          <ReservaForm
            reserva={modal.reserva}
            onCancel={() => setModal(null)}
            onSaved={(creada) => {
              if (modal.reserva) setAviso("Reserva modificada");
              else setExito(creada); // cartel "Reservado con éxito"
              setModal(null);
              cargar();
            }}
          />
        </Modal>
      )}

      {exito && <ReservaExito reserva={exito} onClose={() => setExito(null)} />}

      {pedido && (
        <Modal title="Pedido de comida" onClose={() => setPedido(null)}>
          <PedidoForm
            reserva={pedido}
            onCancel={() => setPedido(null)}
            onSaved={() => {
              setAviso("Pedido guardado");
              setPedido(null);
              cargar();
            }}
          />
        </Modal>
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
