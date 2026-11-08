from app.core.database import fetch_all, fetch_one


async def resumen(conn) -> dict:
    """Indicadores del dashboard (subconsultas escalares)."""
    fila = await fetch_one(
        conn,
        """
        SELECT
          (SELECT COUNT(*) FROM reservas
            WHERE fecha = CURDATE() AND estado <> 'cancelada')                AS reservas_hoy,
          (SELECT COUNT(*) FROM reservas
            WHERE estado = 'confirmada' AND fecha >= CURDATE())               AS proximas_confirmadas,
          (SELECT COUNT(*) FROM restaurantes WHERE activo = TRUE)             AS restaurantes_activos,
          (SELECT COUNT(*) FROM mesas WHERE activa = TRUE)                    AS mesas_activas,
          (SELECT COUNT(*) FROM reservas WHERE estado = 'en_curso')           AS mesas_ocupadas,
          COALESCE((SELECT SUM(monto) FROM pagos
                    WHERE DATE(pagado_en) = CURDATE()), 0)                    AS ingresos_hoy,
          COALESCE((SELECT ROUND(100 * SUM(estado = 'cancelada') / COUNT(*), 1)
                    FROM reservas), 0)                                        AS tasa_cancelacion
        """,
    )
    fila["ingresos_hoy"] = float(fila["ingresos_hoy"])
    return fila


async def por_restaurante(conn) -> list[dict]:
    """CONSULTA 2 - INNER JOIN + GROUP BY."""
    return await fetch_all(
        conn,
        """
        SELECT rest.nombre AS restaurante,
               COUNT(r.id) AS total_reservas,
               CAST(COALESCE(SUM(r.cantidad_personas), 0) AS SIGNED) AS total_comensales
        FROM restaurantes rest
        INNER JOIN mesas m    ON m.restaurante_id = rest.id
        INNER JOIN reservas r ON r.mesa_id = m.id
        WHERE r.estado <> 'cancelada'
        GROUP BY rest.id, rest.nombre
        ORDER BY total_reservas DESC
        """,
    )


async def clientes_frecuentes(conn) -> list[dict]:
    """CONSULTA 3 - GROUP BY + HAVING con SUBCONSULTA (clientes sobre el promedio)."""
    return await fetch_all(
        conn,
        """
        SELECT u.nombre AS cliente, u.email, COUNT(r.id) AS reservas
        FROM usuarios u
        INNER JOIN reservas r ON r.usuario_id = u.id
        GROUP BY u.id, u.nombre, u.email
        HAVING COUNT(r.id) > (
            SELECT AVG(cant) FROM (
                SELECT COUNT(*) AS cant FROM reservas GROUP BY usuario_id
            ) AS conteo
        )
        ORDER BY reservas DESC
        """,
    )


async def por_franja(conn) -> list[dict]:
    """GROUP BY por franja horaria: ¿a qué hora se reserva más?"""
    return await fetch_all(
        conn,
        """
        SELECT TIME_FORMAT(hora, '%%H:00') AS franja, COUNT(*) AS reservas
        FROM reservas
        WHERE estado <> 'cancelada'
        GROUP BY franja
        ORDER BY franja
        """,
    )


async def ingresos_por_medio(conn) -> list[dict]:
    """GROUP BY: cuánto dinero entró por cada medio de pago."""
    filas = await fetch_all(
        conn,
        """
        SELECT medio_pago, COUNT(*) AS cantidad, SUM(monto) AS total
        FROM pagos
        GROUP BY medio_pago
        ORDER BY total DESC
        """,
    )
    return [{**f, "total": float(f["total"])} for f in filas]
