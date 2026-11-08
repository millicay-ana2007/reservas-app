"""Hash de contraseñas (bcrypt) y manejo de tokens JWT."""
import asyncio
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


async def hash_password(password: str) -> str:
    # bcrypt es CPU-intensivo: se ejecuta en un hilo para no bloquear el event loop
    hashed = await asyncio.to_thread(bcrypt.hashpw, password.encode(), bcrypt.gensalt())
    return hashed.decode()


async def verify_password(password: str, password_hash: str) -> bool:
    try:
        return await asyncio.to_thread(bcrypt.checkpw, password.encode(), password_hash.encode())
    except ValueError:  # hash inválido (p. ej. el de relleno del script SQL)
        return False


def create_access_token(usuario: dict) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(usuario["id"]),
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "rol": usuario["rol"],
        "exp": expira,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Lanza jwt.PyJWTError si el token es inválido o expiró."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
