import { useEffect, useState } from "react";
import { pagosApi, reportesApi, reservasApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import { exportarExcel, exportarPDF } from "../utils/exporters";
import { MEDIOS_PAGO, formatFecha, formatMoneda } from "../utils/validators";

// Cada reporte se define con su fuente de datos y sus columnas (se reutilizan para tabla, PDF y Excel)
const REPORTES = {
  reservas: {
    titulo: "Reservas detalladas",
    archivo: "reservas-detalle",
    cargar: (f) => reservasApi.listar(f),
    columnas: [
      { key: "cliente", label: "Cliente" },
      { key: "restaurante", label: "Restaurante" },
      { key: "mesa_numero", label: "Mesa" },
      { key: "fecha", label: "Fecha", accessor: (r) => formatFecha(r.fecha) },
      { key: "hora", label: "Hora" },
      { key: "cantidad_personas", label: "Personas" },
      { key: "estado", label: "Estado" },
    ],
  },
  pagos: {
    titulo: "Pagos registrados",
    archivo: "pagos-registrados",
    cargar: () => pagosApi.listar(),
    columnas: [
      { key: "cliente", label: "Cliente" },
      { key: "restaurante", label: "Restaurante" },
      { key: "mesa_numero", label: "Mesa" },
      { key: "fecha", label: "Fecha", accessor: (r) => formatFecha(r.fecha) },
      { key: "hora", label: "Hora" },
      { key: "medio_pago", label: "Medio de pago", accessor: (r) => MEDIOS_PAGO[r.medio_pago] || r.medio_pago },
      { key: "monto", label: "Monto", accessor: (r) => formatMoneda(r.monto) },
    ],
  },
  ingresos: {
    titulo: "Ingresos por medio de pago",
    archivo: "ingresos-por-medio-de-pago",
    cargar: () => reportesApi.ingresosPorMedio(),
    columnas: [
      { key: "medio_pago", label: "Medio de pago", accessor: (r) => MEDIOS_PAGO[r.medio_pago] || r.medio_pago },
      { key: "cantidad", label: "Pagos" },
      { key: "total", label: "Total", accessor: (r) => formatMoneda(r.total) },
    ],
  },
  restaurantes: {
    titulo: "Reservas por restaurante",
    archivo: "reservas-por-restaurante",
    cargar: () => reportesApi.porRestaurante(),
    columnas: [
      { key: "restaurante", label: "Restaurante" },
      { key: "total_reservas", label: "Reservas" },
      { key: "total_comensales", label: "Comensales" },
    ],
  },
  clientes: {
    titulo: "Clientes con más reservas que el promedio",
    archivo: "clientes-frecuentes",
    cargar: () => reportesApi.clientesFrecuentes(),
    columnas: [
      { key: "cliente", label: "Cliente" },
      { key: "email", label: "Email" },
      { key: "reservas", label: "Reservas" },
    ],
  },
  franjas: {
    titulo: "Reservas por franja horaria",
    archivo: "reservas-por-franja",
    cargar: () => reportesApi.porFranja(),
    columnas: [
      { key: "franja", label: "Franja" },
      { key: "reservas", label: "Reservas" },
    ],
  },
};

export default function Reportes() {
  const [tipo, setTipo] = useState("reservas");
  const [filtros, setFiltros] = useState({ estado: "", fecha: "" });
  const [rows, setRows] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const reporte = REPORTES[tipo];

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    reporte
      .cargar(tipo === "reservas" ? filtros : undefined)
      .then((d) => vigente && (setRows(d.map((f, i) => ({ ...f, id: f.id ?? i }))), setError("")))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [tipo, filtros]);

  const puedeExportar = rows.length > 0 && !cargando;

  return (
    <>
      <header className="page-header">
        <h1>Reportes</h1>
        <p>Consultá la información y exportala a PDF o Excel.</p>
      </header>

      <div className="toolbar">
        <label className="inline-field">
          Reporte
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(REPORTES).map(([k, r]) => <option key={k} value={k}>{r.titulo}</option>)}
          </select>
        </label>
        {tipo === "reservas" && (
          <>
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
          </>
        )}
        <div className="toolbar-end">
          <button className="btn btn-ghost-dark" disabled={!puedeExportar}
            onClick={() => exportarPDF(reporte.archivo, reporte.titulo, reporte.columnas, rows)}>
            Exportar PDF
          </button>
          <button className="btn btn-primary" disabled={!puedeExportar}
            onClick={() => exportarExcel(reporte.archivo, reporte.columnas, rows)}>
            Exportar Excel
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <section className="panel">
        <h2>{reporte.titulo}</h2>
        <DataTable
          loading={cargando}
          rows={rows}
          empty="No hay datos para este reporte."
          columns={reporte.columnas.map((c) => ({
            key: c.key, label: c.label, render: c.accessor ? (f) => c.accessor(f) : undefined,
          }))}
        />
      </section>
    </>
  );
}
