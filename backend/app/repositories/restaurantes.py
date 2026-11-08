from app.core.database import execute, fetch_all, fetch_one, traducir_errores_mysql

COLUMNAS = "id, nombre, direccion, telefono, activo"


async def listar(conn, solo_activos: bool = False) -> list[dict]:
    sql = f"SELECT {COLUMNAS} FROM restaurantes"
    if solo_activos:
        sql += " WHERE activo = TRUE"
    return await fetch_all(conn, sql + " ORDER BY nombre")


async def obtener(conn, restaurante_id: int) -> dict | None:
    return await fetch_one(conn, f"SELECT {COLUMNAS} FROM restaurantes WHERE id = %s", (restaurante_id,))


async def crear(conn, d: dict) -> int:
    return await execute(
        conn,
        "INSERT INTO restaurantes (nombre, direccion, telefono, activo) VALUES (%s, %s, %s, %s)",
        (d["nombre"], d["direccion"], d["telefono"], d["activo"]),
    )


async def actualizar(conn, restaurante_id: int, d: dict) -> None:
    await execute(
        conn,
        "UPDATE restaurantes SET nombre=%s, direccion=%s, telefono=%s, activo=%s WHERE id=%s",
        (d["nombre"], d["direccion"], d["telefono"], d["activo"], restaurante_id),
    )


async def eliminar(conn, restaurante_id: int) -> None:
    with traducir_errores_mysql():
        await execute(conn, "DELETE FROM restaurantes WHERE id = %s", (restaurante_id,))
