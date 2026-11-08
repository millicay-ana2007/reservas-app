"""Lógica de autenticación: registro e inicio de sesión."""
from app.core.exceptions import UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import usuarios as repo


async def registrar(conn, nombre: str, email: str, password: str) -> dict:
    password_hash = await hash_password(password)
    # El registro público siempre crea clientes; el rol admin no se puede auto-asignar
    usuario_id = await repo.crear(conn, nombre, email.lower(), password_hash, rol="cliente")
    usuario = {"id": usuario_id, "nombre": nombre, "email": email.lower(), "rol": "cliente"}
    return _respuesta_token(usuario)


async def iniciar_sesion(conn, email: str, password: str) -> dict:
    usuario = await repo.obtener_por_email(conn, email.lower())
    # Mismo mensaje para email inexistente y clave incorrecta (no revela cuál falló)
    if usuario is None or not await verify_password(password, usuario["password_hash"]):
        raise UnauthorizedError("Email o contraseña incorrectos")
    return _respuesta_token(usuario)


def _respuesta_token(usuario: dict) -> dict:
    return {
        "access_token": create_access_token(usuario),
        "token_type": "bearer",
        "usuario": {k: usuario[k] for k in ("id", "nombre", "email", "rol")},
    }
