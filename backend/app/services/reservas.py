"""Reglas de negocio de reservas: quién puede ver/modificar qué."""
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.repositories import mesas as mesas_repo
from app.repositories import pedidos as pedidos_repo
from app.repositories import reservas as repo


def _es_admin(user: dict) -> bool:
    return user["rol"] == "admin"


async def listar(conn, user: dict, estado=None, fecha=None, restaurante_id=None):
    # Un cliente solo ve sus propias reservas; el admin ve todas
    usuario_id = None if _es_admin(user) else user["id"]
    return await repo.listar(conn, usuario_id, estado, fecha, restaurante_id)


async def obtener(conn, user: dict, reserva_id: int) -> dict:
    reserva = await repo.obtener(conn, reserva_id)
    if reserva is None:
        raise NotFoundError("Reserva no encontrada")
    if not _es_admin(user) and reserva["usuario_id"] != user["id"]:
        raise ForbiddenError("No tenés permiso sobre esta reserva")
    return reserva


async def crear(conn, user: dict, datos) -> dict:
    nuevo_id = await repo.crear(
        conn, user["id"], datos.mesa_id, datos.fecha, datos.hora, datos.cantidad_personas
    )
    items = [i.model_dump() for i in getattr(datos, "items", [])]
    if items:
        try:
            await pedidos_repo.guardar(conn, nuevo_id, items)
        except Exception:
            # Si el pedido es inválido no dejamos una reserva a medias
            await repo.eliminar(conn, nuevo_id)
            raise
    return await repo.obtener(conn, nuevo_id)


async def modificar(conn, user: dict, reserva_id: int, datos) -> dict:
    reserva = await obtener(conn, user, reserva_id)  # valida existencia y permisos
    await repo.modificar(conn, reserva_id, datos.mesa_id, datos.fecha, datos.hora, datos.cantidad_personas)
    # El menú es de cada restaurante: si cambia de local, el pedido anterior ya no vale
    mesa = await mesas_repo.obtener(conn, datos.mesa_id)
    if mesa and mesa["restaurante_id"] != reserva["restaurante_id"]:
        await pedidos_repo.limpiar(conn, reserva_id)
    return await repo.obtener(conn, reserva_id)


async def cambiar_estado(conn, user: dict, reserva_id: int, estado: str) -> dict:
    reserva = await obtener(conn, user, reserva_id)
    if not _es_admin(user) and estado != "cancelada":
        raise ForbiddenError("Solo podés cancelar tus reservas")
    if reserva["estado"] != "confirmada":
        raise ConflictError("Solo se pueden cancelar reservas confirmadas")
    await repo.cambiar_estado(conn, reserva_id, estado)
    return await repo.obtener(conn, reserva_id)


async def registrar_llegada(conn, reserva_id: int) -> dict:
    if await repo.obtener(conn, reserva_id) is None:
        raise NotFoundError("Reserva no encontrada")
    await repo.registrar_llegada(conn, reserva_id)
    return await repo.obtener(conn, reserva_id)


async def eliminar(conn, reserva_id: int) -> None:
    if await repo.obtener(conn, reserva_id) is None:
        raise NotFoundError("Reserva no encontrada")
    await repo.eliminar(conn, reserva_id)
