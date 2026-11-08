"""Reglas del pedido de comida: quién puede cambiarlo y cuándo se sirve."""
from datetime import timedelta

from app.core.exceptions import ConflictError, ForbiddenError
from app.repositories import pedidos as repo
from app.services import reservas as reservas_service


async def obtener(conn, user: dict, reserva_id: int) -> dict:
    await reservas_service.obtener(conn, user, reserva_id)  # valida existencia y permisos
    items = await repo.listar(conn, reserva_id)
    return {"reserva_id": reserva_id, "items": items, "total": await repo.total(conn, reserva_id)}


async def guardar(conn, user: dict, reserva_id: int, datos) -> dict:
    reserva = await reservas_service.obtener(conn, user, reserva_id)
    # El cliente arma su pedido antes de llegar; una vez en la mesa lo carga el administrador
    if user["rol"] != "admin" and reserva["estado"] != "confirmada":
        raise ForbiddenError("Solo podés cambiar tu pedido antes de ingresar al local")
    await repo.guardar(conn, reserva_id, [i.model_dump() for i in datos.items])
    return await obtener(conn, user, reserva_id)


async def fijar_servicio(conn, user: dict, reserva_id: int, datos) -> dict:
    reserva = await reservas_service.obtener(conn, user, reserva_id)
    if reserva["estado"] not in ("confirmada", "en_curso"):
        raise ConflictError("Solo se puede elegir el horario de reservas confirmadas o en curso")
    if reserva["total_pedido"] <= 0:
        raise ConflictError("Primero elegí qué querés comer del menú")
    if datos.momento == "personalizado" and datos.hora.strftime("%H:%M") < reserva["hora"]:
        raise ConflictError(f"La comida no puede servirse antes de la hora de tu reserva ({reserva['hora']})")
    await repo.fijar_servicio(conn, reserva_id, datos.momento, datos.hora)
    return await reservas_service.obtener(conn, user, reserva_id)


_MINUTOS = {"al_entrar": 0, "min_10": 10, "min_20": 20}


async def pendientes_hoy(conn) -> list[dict]:
    """Pedidos de hoy con la hora exacta en que hay que servir cada uno."""
    filas = await repo.pendientes_hoy(conn)
    for f in filas:
        llegada = f.pop("llegada_en")
        f["llegada"] = llegada.strftime("%H:%M") if llegada else None
        momento = f["momento_servicio"]
        if momento == "personalizado":
            f["servir_a"] = f["hora_servicio"]
        elif momento in _MINUTOS and llegada:
            f["servir_a"] = (llegada + timedelta(minutes=_MINUTOS[momento])).strftime("%H:%M")
        else:
            f["servir_a"] = None  # todavía no llegó o el anfitrión decide
    return filas
