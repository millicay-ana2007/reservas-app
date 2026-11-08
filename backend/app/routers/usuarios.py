from fastapi import APIRouter, Depends, Response, status

from app.core.database import get_db
from app.core.deps import require_admin
from app.schemas.usuario import UsuarioCrear, UsuarioEditar, UsuarioOut
from app.services import usuarios as service

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


@router.get("", response_model=list[UsuarioOut])
async def listar(_=Depends(require_admin), conn=Depends(get_db)):
    return await service.listar(conn)


@router.get("/{usuario_id}", response_model=UsuarioOut)
async def obtener(usuario_id: int, _=Depends(require_admin), conn=Depends(get_db)):
    return await service.obtener(conn, usuario_id)


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear(datos: UsuarioCrear, _=Depends(require_admin), conn=Depends(get_db)):
    return await service.crear(conn, datos)


@router.put("/{usuario_id}", response_model=UsuarioOut)
async def actualizar(usuario_id: int, datos: UsuarioEditar, admin=Depends(require_admin), conn=Depends(get_db)):
    return await service.actualizar(conn, admin, usuario_id, datos)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(usuario_id: int, admin=Depends(require_admin), conn=Depends(get_db)):
    await service.eliminar(conn, admin, usuario_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
