from datetime import date, time

from app.core.database import execute, fetch_all, fetch_one, traducir_errores_mysql

# CONSULTA 1 - INNER JOIN de 4 tablas + subconsulta con SUM (total del pedido de comida)
SELECT_RESERVA = """
SELECT r.id, r.usuario_id, u.nombre AS cliente,
       rest.id AS restaurante_id, rest.nombre AS restaurante,
       m.id AS mesa_id, m.numero AS mesa_numero,
       r.fecha, TIME_FORMAT(r.hora, '%%H:%%i') AS hora,
       r.cantidad_personas, r.estado,
       TIME_FORMAT(r.llegada_en, '%%H:%%i')    AS llegada,
       TIME_FORMAT(r.finalizada_en, '%%H:%%i') AS salida,
       p.monto AS monto_pagado, p.medio_pago,
       r.momento_servicio, TIME_FORMAT(r.hora_servicio, '%%H:%%i') AS hora_servicio,
       (SELECT COALESCE(SUM(pi.cantidad * pi.precio_unitario), 0)
          FROM pedido_items pi WHERE pi.reserva_id = r.id) AS total_pedido
FROM reservas r
INNER JOIN usuarios u        ON u.id = r.usuario_id
INNER JOIN mesas m           ON m.id = r.mesa_id
INNER JOIN restaurantes rest ON rest.id = m.restaurante_id
LEFT JOIN pagos p            ON p.reserva_id = r.id
"""


def _normalizar(fila: dict | None) -> dict | None:
    # DECIMAL llega como Decimal; la API lo expone como número
    if fila:
        if fila.get("monto_pagado") is not None:
            fila["monto_pagado"] = float(fila["monto_pagado"])
        fila["total_pedido"] = float(fila["total_pedido"])
    return fila


async def listar(
    conn,
    usuario_id: int | None = None,
    estado: str | None = None,
    fecha: date | None = None,
    restaurante_id: int | None = None,
) -> list[dict]:
    condiciones, params = [], []
    if usuario_id:
        condiciones.append("r.usuario_id = %s")
        params.append(usuario_id)
    if estado:
        condiciones.append("r.estado = %s")
        params.append(estado)
    if fecha:
        condiciones.append("r.fecha = %s")
        params.append(fecha.isoformat())
    if restaurante_id:
        condiciones.append("rest.id = %s")
        params.append(restaurante_id)

    sql = SELECT_RESERVA
    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)
    sql += " ORDER BY r.fecha DESC, r.hora"
    return [_normalizar(f) for f in await fetch_all(conn, sql, tuple(params))]


async def obtener(conn, reserva_id: int) -> dict | None:
    return _normalizar(await fetch_one(conn, SELECT_RESERVA + " WHERE r.id = %s", (reserva_id,)))


async def crear(conn, usuario_id: int, mesa_id: int, fecha: date, hora: time, personas: int) -> int:
    """Delega en el stored procedure (transacción con COMMIT/ROLLBACK en MySQL)."""
    async with conn.cursor() as cur:
        with traducir_errores_mysql():
            await cur.execute(
                "CALL sp_crear_reserva(%s, %s, %s, %s, %s, @reserva_id)",
                (usuario_id, mesa_id, fecha.isoformat(), hora.strftime("%H:%M:%S"), personas),
            )
            await cur.execute("SELECT @reserva_id AS id")
            fila = await cur.fetchone()
    return fila["id"]


async def modificar(conn, reserva_id: int, mesa_id: int, fecha: date, hora: time, personas: int) -> None:
    with traducir_errores_mysql():
        await execute(
            conn,
            "CALL sp_modificar_reserva(%s, %s, %s, %s, %s)",
            (reserva_id, mesa_id, fecha.isoformat(), hora.strftime("%H:%M:%S"), personas),
        )


async def cambiar_estado(conn, reserva_id: int, estado: str) -> None:
    await execute(conn, "UPDATE reservas SET estado = %s WHERE id = %s", (estado, reserva_id))


async def registrar_llegada(conn, reserva_id: int) -> None:
    """Delega en sp_registrar_llegada: la reserva pasa a en_curso (mesa ocupada)."""
    with traducir_errores_mysql():
        await execute(conn, "CALL sp_registrar_llegada(%s)", (reserva_id,))


async def en_curso(conn) -> list[dict]:
    """Reservas con clientes sentados ahora (mesas ocupadas)."""
    return await fetch_all(
        conn,
        """
        SELECT r.id, r.mesa_id, u.nombre AS cliente, r.cantidad_personas AS personas,
               TIME_FORMAT(r.llegada_en, '%%H:%%i') AS desde
        FROM reservas r
        INNER JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.estado = 'en_curso'
        ORDER BY r.llegada_en
        """,
    )


async def proximas_hoy(conn) -> list[dict]:
    """Reservas confirmadas de hoy que todavía no llegaron (dentro del tiempo estimado)."""
    return await fetch_all(
        conn,
        """
        SELECT r.id, r.mesa_id, u.nombre AS cliente,
               TIME_FORMAT(r.hora, '%%H:%%i') AS hora
        FROM reservas r
        INNER JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.estado = 'confirmada'
          AND r.fecha = CURDATE()
          AND TIMESTAMP(r.fecha, r.hora) > NOW() - INTERVAL fn_minutos_estimados() MINUTE
        ORDER BY r.hora
        """,
    )


async def eliminar(conn, reserva_id: int) -> None:
    with traducir_errores_mysql():
        await execute(conn, "DELETE FROM reservas WHERE id = %s", (reserva_id,))
