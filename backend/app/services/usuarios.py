"""Gestión de usuarios (solo administradores)."""
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.repositories import usuarios as repo


async def listar(conn):
    return await repo.listar(conn)


async def obtener(conn, usuario_id: int) -> dict:
    usuario = await repo.obtener_por_id(conn, usuario_id)
    if usuario is None:
        raise NotFoundError("Usuario no encontrado")
    return usuario


async def crear(conn, datos) -> dict:
    password_hash = await hash_password(datos.password)
    nuevo_id = await repo.crear(conn, datos.nombre, datos.email.lower(), password_hash, datos.rol)
    return await obtener(conn, nuevo_id)


async def actualizar(conn, admin: dict, usuario_id: int, datos) -> dict:
    await obtener(conn, usuario_id)
    # Evita quedarse sin administradores por error
    if usuario_id == admin["id"] and datos.rol != "admin":
        raise ForbiddenError("No podés quitarte a vos mismo el rol de administrador")
    password_hash = await hash_password(datos.password) if datos.password else None
    await repo.actualizar(conn, usuario_id, datos.nombre, datos.email.lower(), datos.rol, password_hash)
    return await obtener(conn, usuario_id)


async def eliminar(conn, admin: dict, usuario_id: int) -> None:
    await obtener(conn, usuario_id)
    if usuario_id == admin["id"]:
        raise ForbiddenError("No podés eliminar tu propio usuario")
    await repo.eliminar(conn, usuario_id)
