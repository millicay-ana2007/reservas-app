from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.deps import require_admin
from app.services import reportes as service
from app.schemas.pago import IngresoMedioOut
from app.schemas.reporte import ClienteFrecuenteOut, PorFranjaOut, PorRestauranteOut, ResumenOut

router = APIRouter(prefix="/reportes", tags=["Reportes"], dependencies=[Depends(require_admin)])


@router.get("/resumen", response_model=ResumenOut)
async def resumen(conn=Depends(get_db)):
    return await service.resumen(conn)


@router.get("/por-restaurante", response_model=list[PorRestauranteOut])
async def por_restaurante(conn=Depends(get_db)):
    return await service.por_restaurante(conn)


@router.get("/clientes-frecuentes", response_model=list[ClienteFrecuenteOut])
async def clientes_frecuentes(conn=Depends(get_db)):
    return await service.clientes_frecuentes(conn)


@router.get("/por-franja", response_model=list[PorFranjaOut])
async def por_franja(conn=Depends(get_db)):
    return await service.por_franja(conn)


@router.get("/ingresos-por-medio", response_model=list[IngresoMedioOut])
async def ingresos_por_medio(conn=Depends(get_db)):
    return await service.ingresos_por_medio(conn)
