"""Reglas de negocio de cobros: solo el administrador registra pagos."""
from app.core.exceptions import NotFoundError
from app.repositories import pagos as repo
from app.repositories import reservas as reservas_repo


async def listar(conn) -> list[dict]:
    return await repo.listar(conn)


async def cobrar(conn, user: dict, reserva_id: int, datos) -> dict:
    if await reservas_repo.obtener(conn, reserva_id) is None:
        raise NotFoundError("Reserva no encontrada")
    pago_id = await repo.cobrar(conn, reserva_id, datos.monto, datos.medio_pago, user["id"])
    return await repo.obtener(conn, pago_id)
