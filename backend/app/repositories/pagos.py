from decimal import Decimal

from app.core.database import fetch_all, fetch_one, traducir_errores_mysql

# INNER JOIN de 5 tablas: pago -> reserva -> cliente / mesa -> restaurante
SELECT_PAGO = """
SELECT p.id, p.reserva_id, u.nombre AS cliente, rest.nombre AS restaurante,
       m.numero AS mesa_numero,
       DATE(p.pagado_en) AS fecha, TIME_FORMAT(p.pagado_en, '%%H:%%i') AS hora,
       p.medio_pago, p.monto
FROM pagos p
INNER JOIN reservas r        ON r.id = p.reserva_id
INNER JOIN usuarios u        ON u.id = r.usuario_id
INNER JOIN mesas m           ON m.id = r.mesa_id
INNER JOIN restaurantes rest ON rest.id = m.restaurante_id
"""


def _normalizar(fila: dict | None) -> dict | None:
    if fila and fila.get("monto") is not None:
        fila["monto"] = float(fila["monto"])
    return fila


async def cobrar(conn, reserva_id: int, monto: Decimal, medio_pago: str, usuario_id: int) -> int:
    """Delega en sp_cobrar_reserva: guarda el pago y cierra la reserva (COMMIT/ROLLBACK en MySQL)."""
    async with conn.cursor() as cur:
        with traducir_errores_mysql():
            await cur.execute(
                "CALL sp_cobrar_reserva(%s, %s, %s, %s, @pago_id)",
                (reserva_id, monto, medio_pago, usuario_id),
            )
            await cur.execute("SELECT @pago_id AS id")
            fila = await cur.fetchone()
    return fila["id"]


async def obtener(conn, pago_id: int) -> dict | None:
    return _normalizar(await fetch_one(conn, SELECT_PAGO + " WHERE p.id = %s", (pago_id,)))


async def listar(conn) -> list[dict]:
    filas = await fetch_all(conn, SELECT_PAGO + " ORDER BY p.pagado_en DESC")
    return [_normalizar(f) for f in filas]
