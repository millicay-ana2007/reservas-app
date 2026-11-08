from fastapi import APIRouter, Depends, Response, status

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.restaurante import RestauranteIn, RestauranteOut
from app.services import restaurantes as service

router = APIRouter(prefix="/restaurantes", tags=["Restaurantes"])


@router.get("", response_model=list[RestauranteOut], dependencies=[Depends(get_current_user)])
async def listar(solo_activos: bool = False, conn=Depends(get_db)):
    return await service.listar(conn, solo_activos)


@router.get("/{restaurante_id}", response_model=RestauranteOut, dependencies=[Depends(get_current_user)])
async def obtener(restaurante_id: int, conn=Depends(get_db)):
    return await service.obtener(conn, restaurante_id)


@router.post("", response_model=RestauranteOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
async def crear(datos: RestauranteIn, conn=Depends(get_db)):
    return await service.crear(conn, datos.model_dump())


@router.put("/{restaurante_id}", response_model=RestauranteOut, dependencies=[Depends(require_admin)])
async def actualizar(restaurante_id: int, datos: RestauranteIn, conn=Depends(get_db)):
    return await service.actualizar(conn, restaurante_id, datos.model_dump())


@router.delete("/{restaurante_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_admin)])
async def eliminar(restaurante_id: int, conn=Depends(get_db)):
    await service.eliminar(conn, restaurante_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
