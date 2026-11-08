from datetime import date

from pydantic import BaseModel


class PagoOut(BaseModel):
    id: int
    reserva_id: int
    cliente: str
    restaurante: str
    mesa_numero: int
    fecha: date
    hora: str
    medio_pago: str
    monto: float


class IngresoMedioOut(BaseModel):
    medio_pago: str
    cantidad: int
    total: float
