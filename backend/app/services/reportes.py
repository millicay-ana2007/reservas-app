"""Capa de servicio de reportes: el router no accede nunca al repository directamente."""
from app.repositories import reportes as repo


async def resumen(conn) -> dict:
    return await repo.resumen(conn)


async def por_restaurante(conn) -> list[dict]:
    return await repo.por_restaurante(conn)


async def clientes_frecuentes(conn) -> list[dict]:
    return await repo.clientes_frecuentes(conn)


async def por_franja(conn) -> list[dict]:
    return await repo.por_franja(conn)


async def ingresos_por_medio(conn) -> list[dict]:
    return await repo.ingresos_por_medio(conn)
