import json
from datetime import time

from app.core.database import execute, fetch_all, fetch_one, traducir_errores_mysql


async def guardar(conn, reserva_id: int, items: list[dict]) -> None:
    """Delega en sp_guardar_pedido: reemplaza el pedido en una transacción (COMMIT/ROLLBACK en MySQL)."""
    with traducir_errores_mysql():
        await execute(conn, "CALL sp_guardar_pedido(%s, %s)", (reserva_id, json.dumps(items)))


async def listar(conn, reserva_id: int) -> list[dict]:
    filas = await fetch_all(
        conn,
        """
        SELECT pi.plato_id, p.nombre, pi.cantidad, pi.precio_unitario,
               pi.cantidad * pi.precio_unitario AS subtotal
        FROM pedido_items pi
        INNER JOIN platos p ON p.id = pi.plato_id
        WHERE pi.reserva_id = %s
        ORDER BY p.nombre
        """,
        (reserva_id,),
    )
    for f in filas:
        f["precio_unitario"] = float(f["precio_unitario"])
        f["subtotal"] = float(f["subtotal"])
    return filas


async def total(conn, reserva_id: int) -> float:
    """GROUP BY / SUM: lo que el cliente tiene que pagar por la comida pedida."""
    fila = await fetch_one(
        conn,
        "SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total FROM pedido_items WHERE reserva_id = %s",
        (reserva_id,),
    )
    return float(fila["total"])


async def limpiar(conn, reserva_id: int) -> None:
    """Quita el pedido y el horario de servicio (p. ej. si la reserva cambia de restaurante)."""
    await execute(conn, "DELETE FROM pedido_items WHERE reserva_id = %s", (reserva_id,))
    await execute(
        conn, "UPDATE reservas SET momento_servicio = NULL, hora_servicio = NULL WHERE id = %s", (reserva_id,)
    )


async def fijar_servicio(conn, reserva_id: int, momento: str, hora: time | None) -> None:
    await execute(
        conn,
        "UPDATE reservas SET momento_servicio = %s, hora_servicio = %s WHERE id = %s",
        (momento, hora.strftime("%H:%M:%S") if hora else None, reserva_id),
    )


async def pendientes_hoy(conn) -> list[dict]:
    """Pedidos de comida de las reservas de hoy que todavía hay que servir (INNER JOIN + subconsulta EXISTS)."""
    reservas = await fetch_all(
        conn,
        """
        SELECT r.id AS reserva_id, u.nombre AS cliente, rest.nombre AS restaurante,
               m.numero AS mesa_numero, r.cantidad_personas AS personas, r.estado,
               TIME_FORMAT(r.hora, '%%H:%%i') AS hora,
               r.llegada_en,
               r.momento_servicio, TIME_FORMAT(r.hora_servicio, '%%H:%%i') AS hora_servicio,
               (SELECT SUM(pi.cantidad * pi.precio_unitario)
                  FROM pedido_items pi WHERE pi.reserva_id = r.id) AS total
        FROM reservas r
        INNER JOIN usuarios u        ON u.id = r.usuario_id
        INNER JOIN mesas m           ON m.id = r.mesa_id
        INNER JOIN restaurantes rest ON rest.id = m.restaurante_id
        WHERE r.fecha = CURDATE()
          AND r.estado IN ('confirmada', 'en_curso')
          AND EXISTS (SELECT 1 FROM pedido_items pi WHERE pi.reserva_id = r.id)
        ORDER BY r.estado = 'en_curso' DESC, r.hora
        """,
    )
    if not reservas:
        return []
    ids = tuple(r["reserva_id"] for r in reservas)
    marcas = ", ".join(["%s"] * len(ids))
    items = await fetch_all(
        conn,
        f"""
        SELECT pi.reserva_id, p.nombre, pi.cantidad
        FROM pedido_items pi
        INNER JOIN platos p ON p.id = pi.plato_id
        WHERE pi.reserva_id IN ({marcas})
        ORDER BY p.nombre
        """,
        ids,
    )
    por_reserva: dict[int, list[dict]] = {}
    for it in items:
        por_reserva.setdefault(it["reserva_id"], []).append({"nombre": it["nombre"], "cantidad": it["cantidad"]})
    for r in reservas:
        r["items"] = por_reserva.get(r["reserva_id"], [])
        r["total"] = float(r["total"])
    return reservas
