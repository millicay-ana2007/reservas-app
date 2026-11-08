import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegistroIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_segura(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("La contraseña debe incluir letras y números")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UsuarioOut(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioOut


def _password_segura(v: str | None) -> str | None:
    if v is not None and not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
        raise ValueError("La contraseña debe incluir letras y números")
    return v


class UsuarioCrear(RegistroIn):
    """Alta hecha por un administrador: puede elegir el rol."""
    rol: Literal["admin", "cliente"] = "cliente"


class UsuarioEditar(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    email: EmailStr
    rol: Literal["admin", "cliente"]
    password: str | None = Field(default=None, min_length=8, max_length=72)  # vacío = no cambiar

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_segura(cls, v):
        return _password_segura(v)
