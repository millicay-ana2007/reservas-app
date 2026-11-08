from pydantic import BaseModel, Field


class MesaIn(BaseModel):
    restaurante_id: int = Field(gt=0)
    numero: int = Field(ge=1, le=999)
    capacidad: int = Field(ge=1, le=20)
    activa: bool = True


class MesaOut(MesaIn):
    id: int
    restaurante: str


class MesaDisponible(BaseModel):
    id: int
    numero: int
    capacidad: int


class MesaEstadoOut(MesaOut):
    """Estado de una mesa en este momento: libre, reservada, ocupada o fuera de servicio."""
    estado: str
    # Si está ocupada: quién es y desde cuándo
    reserva_id: int | None = None
    cliente: str | None = None
    personas: int | None = None
    desde: str | None = None
    # Si tiene una reserva confirmada para hoy que todavía no llegó
    proxima_reserva_id: int | None = None
    proxima_hora: str | None = None
    proxima_cliente: str | None = None
