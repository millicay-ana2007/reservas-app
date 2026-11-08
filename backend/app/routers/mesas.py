from datetime import date, time

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.mesa import MesaDisponible, MesaEstadoOut, MesaIn, MesaOut
from app.services import mesas as service

router = APIRouter(prefix="/mesas", tags=["Mesas"])


@router.get("", response_model=list[MesaOut], dependencies=[Depends(get_current_user)])
async def listar(restaurante_id: int | None = None, conn=Depends(get_db)):
    return await service.listar(conn, restaurante_id)


# Esta ruta va ANTES de /{mesa_id} para que "disponibles" no se interprete como un id
@router.get("/disponibles", response_model=list[MesaDisponible], dependencies=[Depends(get_current_user)])
async def disponibles(
    restaurante_id: int = Query(gt=0),
    fecha: date = Query(),
    hora: time = Query(),
    personas: int = Query(ge=1, le=20),
    excluir_reserva: int = Query(default=0, ge=0),
    conn=Depends(get_db),
):
    return await service.disponibles(conn, restaurante_id, fecha, hora, personas, excluir_reserva)


# También va ANTES de /{mesa_id}
@router.get("/estado", response_model=list[MesaEstadoOut], dependencies=[Depends(require_admin)])
async def estado(restaurante_id: int | None = None, conn=Depends(get_db)):
    return await service.estado_salon(conn, restaurante_id)


@router.get("/{mesa_id}", response_model=MesaOut, dependencies=[Depends(get_current_user)])
async def obtener(mesa_id: int, conn=Depends(get_db)):
    return await service.obtener(conn, mesa_id)


@router.post("", response_model=MesaOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_admin)])
async def crear(datos: MesaIn, conn=Depends(get_db)):
    return await service.crear(conn, datos.model_dump())


@router.put("/{mesa_id}", response_model=MesaOut, dependencies=[Depends(require_admin)])
async def actualizar(mesa_id: int, datos: MesaIn, conn=Depends(get_db)):
    return await service.actualizar(conn, mesa_id, datos.model_dump())


@router.delete("/{mesa_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def eliminar(mesa_id: int, conn=Depends(get_db)):
    await service.eliminar(conn, mesa_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
