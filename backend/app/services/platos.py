from app.core.exceptions import NotFoundError
from app.repositories import platos as repo
from app.repositories import restaurantes as restaurantes_repo


async def listar(conn, user: dict, restaurante_id=None, solo_disponibles=False):
    # Un cliente solo ve los platos disponibles; el admin ve todo el menú
    if user["rol"] != "admin":
        solo_disponibles = True
    return await repo.listar(conn, restaurante_id, solo_disponibles)


async def obtener(conn, plato_id: int):
    plato = await repo.obtener(conn, plato_id)
    if plato is None:
        raise NotFoundError("Plato no encontrado")
    return plato


async def _validar_restaurante(conn, restaurante_id: int) -> None:
    if await restaurantes_repo.obtener(conn, restaurante_id) is None:
        raise NotFoundError("Restaurante no encontrado")


async def crear(conn, datos: dict):
    await _validar_restaurante(conn, datos["restaurante_id"])
    nuevo_id = await repo.crear(conn, datos)
    return await obtener(conn, nuevo_id)


async def actualizar(conn, plato_id: int, datos: dict):
    await obtener(conn, plato_id)
    await _validar_restaurante(conn, datos["restaurante_id"])
    await repo.actualizar(conn, plato_id, datos)
    return await obtener(conn, plato_id)


async def eliminar(conn, plato_id: int) -> None:
    await obtener(conn, plato_id)
    await repo.eliminar(conn, plato_id)
