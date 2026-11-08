from datetime import date, time

from app.core.exceptions import NotFoundError
from app.repositories import mesas as repo
from app.repositories import reservas as reservas_repo
from app.services import restaurantes as restaurantes_service


async def listar(conn, restaurante_id: int | None = None):
    return await repo.listar(conn, restaurante_id)


async def obtener(conn, mesa_id: int):
    mesa = await repo.obtener(conn, mesa_id)
    if mesa is None:
        raise NotFoundError("Mesa no encontrada")
    return mesa


async def crear(conn, datos: dict):
    await restaurantes_service.obtener(conn, datos["restaurante_id"])
    nuevo_id = await repo.crear(conn, datos)
    return await obtener(conn, nuevo_id)


async def actualizar(conn, mesa_id: int, datos: dict):
    await obtener(conn, mesa_id)
    await restaurantes_service.obtener(conn, datos["restaurante_id"])
    await repo.actualizar(conn, mesa_id, datos)
    return await obtener(conn, mesa_id)


async def eliminar(conn, mesa_id: int) -> None:
    await obtener(conn, mesa_id)
    await repo.eliminar(conn, mesa_id)


async def disponibles(conn, restaurante_id: int, fecha: date, hora: time, personas: int, excluir_reserva: int = 0):
    return await repo.disponibles(conn, restaurante_id, fecha, hora, personas, excluir_reserva)


async def estado_salon(conn, restaurante_id: int | None = None) -> list[dict]:
    """Estado de cada mesa en este momento. Se calcula a partir de las reservas
    (no se guarda en ninguna columna), así nunca queda desactualizado:
      - ocupada: hay una reserva en curso (clientes sentados, todavía sin cobrar)
      - reservada: tiene una reserva confirmada de hoy que todavía no llegó
      - libre: ninguna de las anteriores (por ejemplo, apenas se registra el cobro)
    """
    mesas = await repo.listar(conn, restaurante_id)
    ocupadas = {r["mesa_id"]: r for r in await reservas_repo.en_curso(conn)}
    proximas: dict[int, dict] = {}
    for r in await reservas_repo.proximas_hoy(conn):  # vienen ordenadas por hora
        proximas.setdefault(r["mesa_id"], r)

    resultado = []
    for mesa in mesas:
        ocupada = ocupadas.get(mesa["id"])
        proxima = proximas.get(mesa["id"])
        if not mesa["activa"]:
            estado = "fuera_de_servicio"
        elif ocupada:
            estado = "ocupada"
        elif proxima:
            estado = "reservada"
        else:
            estado = "libre"
        resultado.append(
            {
                **mesa,
                "estado": estado,
                "reserva_id": ocupada["id"] if ocupada else None,
                "cliente": ocupada["cliente"] if ocupada else None,
                "personas": ocupada["personas"] if ocupada else None,
                "desde": ocupada["desde"] if ocupada else None,
                "proxima_reserva_id": proxima["id"] if proxima else None,
                "proxima_hora": proxima["hora"] if proxima else None,
                "proxima_cliente": proxima["cliente"] if proxima else None,
            }
        )
    return resultado
