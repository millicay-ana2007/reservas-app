"""Reemplaza los hashes de relleno del script SQL por hashes bcrypt reales.

Uso (desde la carpeta backend):  python -m scripts.cargar_passwords
Credenciales resultantes:
    admin@claudia.com  /  Admin1234
    lucia@mail.com, marcos@mail.com, ana@mail.com  /  Cliente1234
"""
import asyncio

import aiomysql

from app.core.config import settings
from app.core.security import hash_password


async def main() -> None:
    conn = await aiomysql.connect(
        host=settings.db_host, port=settings.db_port, user=settings.db_user,
        password=settings.db_password, db=settings.db_name, autocommit=True,
    )
    hash_admin = await hash_password("Admin1234")
    hash_cliente = await hash_password("Cliente1234")
    async with conn.cursor() as cur:
        await cur.execute("UPDATE usuarios SET password_hash=%s WHERE rol='admin'", (hash_admin,))
        await cur.execute("UPDATE usuarios SET password_hash=%s WHERE rol='cliente'", (hash_cliente,))
    conn.close()
    print("Contraseñas actualizadas.")


if __name__ == "__main__":
    asyncio.run(main())
