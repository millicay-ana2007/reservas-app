"""Dependencias de autenticación y autorización (JWT + roles)."""
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_token

bearer = HTTPBearer(auto_error=False)


async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None:
        raise UnauthorizedError("Falta el token de autenticación")
    try:
        payload = decode_token(creds.credentials)
    except jwt.PyJWTError:
        raise UnauthorizedError("Token inválido o expirado")
    return {
        "id": int(payload["sub"]),
        "nombre": payload["nombre"],
        "email": payload["email"],
        "rol": payload["rol"],
    }


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["rol"] != "admin":
        raise ForbiddenError("Esta acción requiere rol de administrador")
    return user
