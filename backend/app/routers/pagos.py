from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.deps import require_admin
from app.schemas.pago import PagoOut
from app.services import pagos as service

router = APIRouter(prefix="/pagos", tags=["Pagos"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[PagoOut])
async def listar(conn=Depends(get_db)):
    return await service.listar(conn)
