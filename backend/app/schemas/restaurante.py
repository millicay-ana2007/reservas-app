from pydantic import BaseModel, Field, field_validator


class RestauranteIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    direccion: str = Field(min_length=3, max_length=200)
    telefono: str = Field(pattern=r"^[0-9+\-\s()]{6,30}$")
    activo: bool = True

    @field_validator("nombre", "direccion")
    @classmethod
    def limpiar(cls, v: str) -> str:
        return v.strip()


class RestauranteOut(RestauranteIn):
    id: int
