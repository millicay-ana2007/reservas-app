from app.core.exceptions import NotFoundError
from app.repositories import restaurantes as repo


async def listar(conn, solo_activos: bool = False):
    return await repo.listar(conn, solo_activos)


async def obtener(conn, restaurante_id: int):
    restaurante = await repo.obtener(conn, restaurante_id)
    if restaurante is None:
        raise NotFoundError("Restaurante no encontrado")
    return restaurante


async def crear(conn, datos: dict):
    nuevo_id = await repo.crear(conn, datos)
    return await obtener(conn, nuevo_id)


async def actualizar(conn, restaurante_id: int, datos: dict):
    await obtener(conn, restaurante_id)
    await repo.actualizar(conn, restaurante_id, datos)
    return await obtener(conn, restaurante_id)


async def eliminar(conn, restaurante_id: int) -> None:
    await obtener(conn, restaurante_id)
    await repo.eliminar(conn, restaurante_id)
