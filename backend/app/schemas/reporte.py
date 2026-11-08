from pydantic import BaseModel


class ResumenOut(BaseModel):
    reservas_hoy: int
    proximas_confirmadas: int
    restaurantes_activos: int
    mesas_activas: int
    mesas_ocupadas: int
    ingresos_hoy: float
    tasa_cancelacion: float


class PorRestauranteOut(BaseModel):
    restaurante: str
    total_reservas: int
    total_comensales: int


class ClienteFrecuenteOut(BaseModel):
    cliente: str
    email: str
    reservas: int


class PorFranjaOut(BaseModel):
    franja: str
    reservas: int
