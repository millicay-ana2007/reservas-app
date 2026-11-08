from fastapi import APIRouter, Depends, Response, status

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.plato import PlatoIn, PlatoOut
from app.services import platos as service

router = APIRouter(prefix="/platos", tags=["Menú"])


@router.get("", response_model=list[PlatoOut])
async def listar(
    restaurante_id: int | None = None,
    solo_disponibles: bool = False,
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    return await service.listar(conn, user, restaurante_id, solo_disponibles)


@router.get("/{plato_id}", response_model=PlatoOut, dependencies=[Depends(get_current_user)])
async def obtener(plato_id: int, conn=Depends(get_db)):
    return await service.obtener(conn, plato_id)


@router.post("", response_model=PlatoOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def crear(datos: PlatoIn, conn=Depends(get_db)):
    return await service.crear(conn, datos.model_dump())


@router.put("/{plato_id}", response_model=PlatoOut, dependencies=[Depends(require_admin)])
async def actualizar(plato_id: int, datos: PlatoIn, conn=Depends(get_db)):
    return await service.actualizar(conn, plato_id, datos.model_dump())


@router.delete("/{plato_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def eliminar(plato_id: int, conn=Depends(get_db)):
    await service.eliminar(conn, plato_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
