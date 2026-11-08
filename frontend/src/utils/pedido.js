// Ayudas para armar el pedido de comida a partir de {plato_id: cantidad}
export const itemsDe = (cantidades) =>
  Object.entries(cantidades)
    .filter(([, cantidad]) => cantidad > 0)
    .map(([id, cantidad]) => ({ plato_id: Number(id), cantidad }));

export const totalDe = (platos, cantidades) =>
  platos.reduce((suma, p) => suma + (cantidades[p.id] || 0) * p.precio, 0);

export const cantidadesDe = (items) => Object.fromEntries(items.map((i) => [i.plato_id, i.cantidad]));
