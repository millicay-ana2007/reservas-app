"""Acceso asíncrono a MySQL con un pool de conexiones (aiomysql)."""
from contextlib import contextmanager

import aiomysql
from pymysql.err import MySQLError

from app.core.config import settings
from app.core.exceptions import ConflictError

_pool: aiomysql.Pool | None = None

# Códigos de error de MySQL que traducimos a mensajes entendibles
ERR_SIGNAL = 1644      # SIGNAL SQLSTATE '45000' lanzado por los stored procedures
ERR_DUPLICADO = 1062
ERR_FK_PADRE = 1451    # no se puede borrar: hay filas hijas
ERR_FK_HIJA = 1452     # la fila referenciada no existe


async def init_pool() -> None:
    global _pool
    _pool = await aiomysql.create_pool(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        db=settings.db_name,
        minsize=1,
        maxsize=10,
        autocommit=True,
        charset="utf8mb4",
        cursorclass=aiomysql.DictCursor,
    )


async def close_pool() -> None:
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()


async def get_db():
    """Dependencia de FastAPI: presta una conexión del pool durante la petición."""
    async with _pool.acquire() as conn:
        yield conn


async def fetch_all(conn, sql: str, params: tuple = ()) -> list[dict]:
    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        return list(await cur.fetchall())


async def fetch_one(conn, sql: str, params: tuple = ()) -> dict | None:
    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        return await cur.fetchone()


async def execute(conn, sql: str, params: tuple = ()) -> int:
    """Ejecuta INSERT/UPDATE/DELETE. Devuelve el id insertado (o 0)."""
    async with conn.cursor() as cur:
        await cur.execute(sql, params)
        return cur.lastrowid


@contextmanager
def traducir_errores_mysql():
    """Convierte errores de MySQL en ConflictError con un mensaje claro."""
    try:
        yield
    except MySQLError as e:
        code = e.args[0] if e.args else 0
        if code == ERR_SIGNAL:
            raise ConflictError(e.args[1])
        if code == ERR_DUPLICADO:
            raise ConflictError("Ya existe un registro con esos datos")
        if code == ERR_FK_PADRE:
            raise ConflictError("No se puede eliminar: tiene registros asociados")
        if code == ERR_FK_HIJA:
            raise ConflictError("Uno de los datos relacionados no existe")
        raise
