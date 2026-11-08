from datetime import date, time

from app.core.database import execute, fetch_all, fetch_one, traducir_errores_mysql

SELECT_MESA = """
SELECT m.id, m.restaurante_id, rest.nombre AS restaurante, m.numero, m.capacidad, m.activa
FROM mesas m
INNER JOIN restaurantes rest ON rest.id = m.restaurante_id
"""


async def listar(conn, restaurante_id: int | None = None) -> list[dict]:
    if restaurante_id:
        return await fetch_all(
            conn, SELECT_MESA + " WHERE m.restaurante_id = %s ORDER BY m.numero", (restaurante_id,)
        )
    return await fetch_all(conn, SELECT_MESA + " ORDER BY rest.nombre, m.numero")


async def obtener(conn, mesa_id: int) -> dict | None:
    return await fetch_one(conn, SELECT_MESA + " WHERE m.id = %s", (mesa_id,))


async def crear(conn, d: dict) -> int:
    with traducir_errores_mysql():
        return await execute(
            conn,
            "INSERT INTO mesas (restaurante_id, numero, capacidad, activa) VALUES (%s, %s, %s, %s)",
            (d["restaurante_id"], d["numero"], d["capacidad"], d["activa"]),
        )


async def actualizar(conn, mesa_id: int, d: dict) -> None:
    with traducir_errores_mysql():
        await execute(
            conn,
            "UPDATE mesas SET restaurante_id=%s, numero=%s, capacidad=%s, activa=%s WHERE id=%s",
            (d["restaurante_id"], d["numero"], d["capacidad"], d["activa"], mesa_id),
        )


async def eliminar(conn, mesa_id: int) -> None:
    with traducir_errores_mysql():
        await execute(conn, "DELETE FROM mesas WHERE id = %s", (mesa_id,))


async def disponibles(
    conn, restaurante_id: int, fecha: date, hora: time, personas: int, excluir_reserva: int = 0
) -> list[dict]:
    """Mesas activas con capacidad suficiente y sin conflictos en ese horario.
    La regla de conflictos vive en la función SQL fn_conflictos_mesa (la misma que usan
    los stored procedures): una mesa con clientes que ya pagaron figura libre."""
    sql = """
    SELECT m.id, m.numero, m.capacidad
    FROM mesas m
    WHERE m.restaurante_id = %s
      AND m.activa = TRUE
      AND m.capacidad >= %s
      AND fn_conflictos_mesa(m.id, TIMESTAMP(%s, %s), %s) = 0
    ORDER BY m.capacidad, m.numero
    """
    return await fetch_all(
        conn,
        sql,
        (restaurante_id, personas, fecha.isoformat(), hora.strftime("%H:%M:%S"), excluir_reserva),
    )
