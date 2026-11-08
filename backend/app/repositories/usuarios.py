from app.core.database import execute, fetch_all, fetch_one, traducir_errores_mysql


async def obtener_por_email(conn, email: str) -> dict | None:
    return await fetch_one(conn, "SELECT * FROM usuarios WHERE email = %s", (email,))


async def crear(conn, nombre: str, email: str, password_hash: str, rol: str = "cliente") -> int:
    with traducir_errores_mysql():
        return await execute(
            conn,
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (%s, %s, %s, %s)",
            (nombre, email, password_hash, rol),
        )


async def listar(conn) -> list[dict]:
    return await fetch_all(conn, "SELECT id, nombre, email, rol FROM usuarios ORDER BY nombre")


async def obtener_por_id(conn, usuario_id: int) -> dict | None:
    return await fetch_one(
        conn, "SELECT id, nombre, email, rol FROM usuarios WHERE id = %s", (usuario_id,)
    )


async def actualizar(conn, usuario_id: int, nombre: str, email: str, rol: str, password_hash: str | None) -> None:
    with traducir_errores_mysql():
        if password_hash:
            await execute(
                conn,
                "UPDATE usuarios SET nombre=%s, email=%s, rol=%s, password_hash=%s WHERE id=%s",
                (nombre, email, rol, password_hash, usuario_id),
            )
        else:
            await execute(
                conn,
                "UPDATE usuarios SET nombre=%s, email=%s, rol=%s WHERE id=%s",
                (nombre, email, rol, usuario_id),
            )


async def eliminar(conn, usuario_id: int) -> None:
    with traducir_errores_mysql():
        await execute(conn, "DELETE FROM usuarios WHERE id = %s", (usuario_id,))
