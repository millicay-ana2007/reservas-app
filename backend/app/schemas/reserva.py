from datetime import date, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.pedido import ItemIn, validar_sin_repetidos

HORA_MIN = time(12, 0)
HORA_MAX = time(23, 30)


class ReservaIn(BaseModel):
    mesa_id: int = Field(gt=0)
    fecha: date
    hora: time
    cantidad_personas: int = Field(ge=1, le=20)

    @field_validator("fecha")
    @classmethod
    def fecha_no_pasada(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("La fecha no puede ser anterior a hoy")
        return v

    @field_validator("hora")
    @classmethod
    def hora_en_servicio(cls, v: time) -> time:
        if not (HORA_MIN <= v <= HORA_MAX):
            raise ValueError("El horario de reservas es de 12:00 a 23:30")
        return v


class ReservaNuevaIn(ReservaIn):
    """Reserva nueva: puede traer ya la comida elegida del menú (opcional)."""
    items: list[ItemIn] = Field(default_factory=list, max_length=50)

    _sin_repetidos = field_validator("items")(validar_sin_repetidos)


class EstadoIn(BaseModel):
    # Desde acá solo se cancela. El ingreso del cliente y el cobro tienen sus
    # propios endpoints (/llegada y /cobro) porque son operaciones transaccionales.
    estado: Literal["cancelada"]


class CobroIn(BaseModel):
    monto: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    medio_pago: Literal["efectivo", "tarjeta", "transferencia", "mercado_pago"]


class ReservaOut(BaseModel):
    id: int
    usuario_id: int
    cliente: str
    restaurante_id: int
    restaurante: str
    mesa_id: int
    mesa_numero: int
    fecha: date
    hora: str
    cantidad_personas: int
    estado: str
    llegada: str | None = None        # hora en que ingresó el cliente (HH:MM)
    salida: str | None = None         # hora en que pagó y liberó la mesa (HH:MM)
    monto_pagado: float | None = None
    medio_pago: str | None = None
    total_pedido: float = 0           # suma de la comida pedida del menú
    momento_servicio: str | None = None   # al_entrar | min_10 | min_20 | personalizado
    hora_servicio: str | None = None      # HH:MM, solo si es personalizado
