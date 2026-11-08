import { useEffect, useState } from "react";
import { reportesApi } from "../api/endpoints";
import DataTable from "../components/DataTable";
import { formatMoneda } from "../utils/validators";

export default function Dashboard() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      reportesApi.resumen(),
      reportesApi.porRestaurante(),
      reportesApi.clientesFrecuentes(),
      reportesApi.porFranja(),
    ])
      .then(([resumen, restaurantes, clientes, franjas]) => setDatos({ resumen, restaurantes, clientes, franjas }))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!datos) return <p className="state-msg">Cargando panel…</p>;

  const { resumen, restaurantes, clientes, franjas } = datos;
  const maxFranja = Math.max(1, ...franjas.map((f) => f.reservas));

  const indicadores = [
    { valor: resumen.reservas_hoy, texto: "reservas para hoy" },
    { valor: resumen.proximas_confirmadas, texto: "confirmadas por venir" },
    { valor: resumen.mesas_ocupadas, texto: "mesas ocupadas ahora" },
    { valor: formatMoneda(resumen.ingresos_hoy), texto: "cobrado hoy" },
    { valor: `${resumen.mesas_activas}`, texto: `mesas en ${resumen.restaurantes_activos} restaurantes` },
    { valor: `${resumen.tasa_cancelacion}%`, texto: "de cancelaciones" },
  ];

  return (
    <>
      <header className="page-header">
        <h1>Panel</h1>
        <p>Resumen de la actividad de reservas.</p>
      </header>

      <section className="stats" aria-label="Indicadores">
        {indicadores.map((i) => (
          <div className="stat" key={i.texto}>
            <strong>{i.valor}</strong>
            <span>{i.texto}</span>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>¿A qué hora se reserva más?</h2>
          {franjas.length === 0 ? (
            <p className="state-msg">Todavía no hay reservas.</p>
          ) : (
            <ul className="bars">
              {franjas.map((f) => (
                <li key={f.franja}>
                  <span className="bar-label">{f.franja}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(f.reservas / maxFranja) * 100}%` }} />
                  </span>
                  <span className="bar-value">{f.reservas}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Clientes por encima del promedio</h2>
          <DataTable
            empty="Ningún cliente supera el promedio de reservas."
            rows={clientes.map((c, i) => ({ ...c, id: i }))}
            columns={[
              { key: "cliente", label: "Cliente" },
              { key: "email", label: "Email" },
              { key: "reservas", label: "Reservas", align: "right" },
            ]}
          />
        </section>
      </div>

      <section className="panel">
        <h2>Actividad por restaurante</h2>
        <DataTable
          rows={restaurantes.map((r, i) => ({ ...r, id: i }))}
          columns={[
            { key: "restaurante", label: "Restaurante" },
            { key: "total_reservas", label: "Reservas", align: "right" },
            { key: "total_comensales", label: "Comensales", align: "right" },
          ]}
        />
      </section>
    </>
  );
}
