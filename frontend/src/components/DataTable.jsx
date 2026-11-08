// columnas: [{ key, label, render?(fila), align? }]
export default function DataTable({ columns, rows, empty = "No hay datos para mostrar", loading = false }) {
  if (loading) return <p className="state-msg">Cargando…</p>;
  if (!rows.length) return <p className="state-msg">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fila, i) => (
            <tr key={fila.id ?? i}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || "left" }}>
                  {c.render ? c.render(fila) : fila[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
