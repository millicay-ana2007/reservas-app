const ETIQUETAS = {
  confirmada: "Confirmada",
  en_curso: "En curso",
  cancelada: "Cancelada",
  completada: "Completada",
};

export default function StatusBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{ETIQUETAS[estado] || estado}</span>;
}
