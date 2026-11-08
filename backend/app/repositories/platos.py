from app.core.database import execute, fetch_all, fetch_one, traducir_errores_mysql

# INNER JOIN platos -> restaurantes
SELECT_PLATO = """
SELECT p.id, p.restaurante_id, rest.nombre AS restaurante,
       p.nombre, p.descripcion, p.precio, p.disponible
FROM platos p
INNER JOIN restaurantes rest ON rest.id = p.restaurante_id
"""


def _normalizar(fila: dict | None) -> dict | None:
    if fila:
        fila["precio"] = float(fila["precio"])
        fila["disponible"] = bool(fila["disponible"])
    return fila


async def listar(conn, restaurante_id: int | None = None, solo_disponibles: bool = False) -> list[dict]:
    condiciones, params = [], []
    if restaurante_id:
        condiciones.append("p.restaurante_id = %s")
        params.append(restaurante_id)
    if solo_disponibles:
        condiciones.append("p.disponible = TRUE")
    sql = SELECT_PLATO
    if condiciones:
        sql += " WHERE " + " AND ".join(condiciones)
    sql += " ORDER BY rest.nombre, p.nombre"
    return [_normalizar(f) for f in await fetch_all(conn, sql, tuple(params))]


async def obtener(conn, plato_id: int) -> dict | None:
    return _normalizar(await fetch_one(conn, SELECT_PLATO + " WHERE p.id = %s", (plato_id,)))


async def crear(conn, d: dict) -> int:
    with traducir_errores_mysql():
        return await execute(
            conn,
            "INSERT INTO platos (restaurante_id, nombre, descripcion, precio, disponible) VALUES (%s, %s, %s, %s, %s)",
            (d["restaurante_id"], d["nombre"], d["descripcion"], d["precio"], d["disponible"]),
        )


async def actualizar(conn, plato_id: int, d: dict) -> None:
    with traducir_errores_mysql():
        await execute(
            conn,
            "UPDATE platos SET restaurante_id=%s, nombre=%s, descripcion=%s, precio=%s, disponible=%s WHERE id=%s",
            (d["restaurante_id"], d["nombre"], d["descripcion"], d["precio"], d["disponible"], plato_id),
        )


async def eliminar(conn, plato_id: int) -> None:
    with traducir_errores_mysql():
        await execute(conn, "DELETE FROM platos WHERE id = %s", (plato_id,))
