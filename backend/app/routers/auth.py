from fastapi import APIRouter, Depends, status

from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.usuario import LoginIn, RegistroIn, TokenOut, UsuarioOut
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def registrar(datos: RegistroIn, conn=Depends(get_db)):
    return await service.registrar(conn, datos.nombre, datos.email, datos.password)


@router.post("/login", response_model=TokenOut)
async def login(datos: LoginIn, conn=Depends(get_db)):
    return await service.iniciar_sesion(conn, datos.email, datos.password)


@router.get("/me", response_model=UsuarioOut)
async def perfil(user=Depends(get_current_user)):
    return user
