from datetime import time
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

MOMENTOS = ("al_entrar", "min_10", "min_20", "personalizado")


class ItemIn(BaseModel):
    plato_id: int = Field(gt=0)
    cantidad: int = Field(ge=1, le=20)


def validar_sin_repetidos(items: list[ItemIn]) -> list[ItemIn]:
    ids = [i.plato_id for i in items]
    if len(ids) != len(set(ids)):
        raise ValueError("Un mismo plato no puede repetirse: sumá la cantidad")
    return items


class PedidoIn(BaseModel):
    items: list[ItemIn] = Field(default_factory=list, max_length=50)

    _sin_repetidos = field_validator("items")(validar_sin_repetidos)


class ItemOut(BaseModel):
    plato_id: int
    nombre: str
    cantidad: int
    precio_unitario: float
    subtotal: float


class PedidoOut(BaseModel):
    reserva_id: int
    items: list[ItemOut]
    total: float


class ServicioIn(BaseModel):
    """Cuándo quiere recibir la comida el cliente, respecto de su ingreso al local."""
    momento: Literal["al_entrar", "min_10", "min_20", "personalizado"]
    hora: time | None = None   # solo para "personalizado"

    @model_validator(mode="after")
    def coherencia(self):
        if self.momento == "personalizado" and self.hora is None:
            raise ValueError("Indicá a qué hora querés recibir la comida")
        if self.momento != "personalizado":
            self.hora = None
        return self


class ItemCocinaOut(BaseModel):
    nombre: str
    cantidad: int


class PedidoCocinaOut(BaseModel):
    """Lo que el anfitrión necesita para servir: qué platos, en qué mesa y a qué hora."""
    reserva_id: int
    cliente: str
    restaurante: str
    mesa_numero: int
    personas: int
    estado: str
    hora: str                          # hora de la reserva
    llegada: str | None = None         # hora en que ingresó el cliente
    momento_servicio: str | None = None
    hora_servicio: str | None = None
    servir_a: str | None = None        # hora exacta de servicio (si ya se puede calcular)
    items: list[ItemCocinaOut]
    total: float
