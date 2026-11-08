import { formatMoneda } from "../utils/validators";
import { totalDe } from "../utils/pedido";

// Lista de platos con su precio. El cliente elige cantidades y ve cuánto va a pagar.
export default function MenuSelector({ platos, cantidades, onChange, vacio }) {
  if (platos.length === 0) return <p className="field-hint">{vacio}</p>;

  const cambiar = (id, delta) => {
    const nueva = Math.max(0, Math.min(20, (cantidades[id] || 0) + delta));
    onChange({ ...cantidades, [id]: nueva });
  };

  return (
    <div className="menu-sel">
      <ul className="menu-lista">
        {platos.map((p) => {
          const cant = cantidades[p.id] || 0;
          return (
            <li key={p.id} className={cant > 0 ? "menu-item menu-item-sel" : "menu-item"}>
              <div className="menu-item-info">
                <strong>{p.nombre}</strong>
                {p.descripcion && <span className="cell-sub">{p.descripcion}</span>}
              </div>
              <span className="menu-precio">{formatMoneda(p.precio)}</span>
              <div className="stepper" role="group" aria-label={`Cantidad de ${p.nombre}`}>
                <button type="button" onClick={() => cambiar(p.id, -1)} disabled={cant === 0} aria-label={`Quitar ${p.nombre}`}>−</button>
                <output aria-live="polite">{cant}</output>
                <button type="button" onClick={() => cambiar(p.id, 1)} disabled={cant >= 20} aria-label={`Agregar ${p.nombre}`}>+</button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="menu-total">
        <span>Total a pagar</span>
        <strong>{formatMoneda(totalDe(platos, cantidades))}</strong>
      </div>
    </div>
  );
}
