from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class PlatoIn(BaseModel):
    restaurante_id: int = Field(gt=0)
    nombre: str = Field(min_length=2, max_length=100)
    descripcion: str = Field(default="", max_length=255)
    precio: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    disponible: bool = True

    @field_validator("nombre", "descripcion")
    @classmethod
    def limpiar(cls, v: str) -> str:
        return v.strip()


class PlatoOut(BaseModel):
    id: int
    restaurante_id: int
    restaurante: str
    nombre: str
    descripcion: str
    precio: float
    disponible: bool
