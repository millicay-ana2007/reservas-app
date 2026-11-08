from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.deps import require_admin
from app.schemas.pedido import PedidoCocinaOut
from app.services import pedidos as service

router = APIRouter(prefix="/pedidos", tags=["Pedidos"], dependencies=[Depends(require_admin)])


@router.get("/hoy", response_model=list[PedidoCocinaOut])
async def pedidos_de_hoy(conn=Depends(get_db)):
    """Qué comida servir hoy, en qué mesa y a qué hora (solo administrador)."""
    return await service.pendientes_hoy(conn)
