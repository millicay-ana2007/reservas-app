from datetime import date

from fastapi import APIRouter, Depends, Response, status

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.schemas.pago import PagoOut
from app.schemas.pedido import PedidoIn, PedidoOut, ServicioIn
from app.schemas.reserva import CobroIn, EstadoIn, ReservaIn, ReservaNuevaIn, ReservaOut
from app.services import pagos as pagos_service
from app.services import pedidos as pedidos_service
from app.services import reservas as service

router = APIRouter(prefix="/reservas", tags=["Reservas"])


@router.get("", response_model=list[ReservaOut])
async def listar(
    estado: str | None = None,
    fecha: date | None = None,
    restaurante_id: int | None = None,
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    return await service.listar(conn, user, estado, fecha, restaurante_id)


@router.get("/{reserva_id}", response_model=ReservaOut)
async def obtener(reserva_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    return await service.obtener(conn, user, reserva_id)


@router.post("", response_model=ReservaOut, status_code=status.HTTP_201_CREATED)
async def crear(datos: ReservaNuevaIn, user=Depends(get_current_user), conn=Depends(get_db)):
    return await service.crear(conn, user, datos)


@router.put("/{reserva_id}", response_model=ReservaOut)
async def modificar(reserva_id: int, datos: ReservaIn, user=Depends(get_current_user), conn=Depends(get_db)):
    return await service.modificar(conn, user, reserva_id, datos)


@router.patch("/{reserva_id}/estado", response_model=ReservaOut)
async def cambiar_estado(reserva_id: int, datos: EstadoIn, user=Depends(get_current_user), conn=Depends(get_db)):
    return await service.cambiar_estado(conn, user, reserva_id, datos.estado)


@router.patch("/{reserva_id}/llegada", response_model=ReservaOut, dependencies=[Depends(require_admin)])
async def registrar_llegada(reserva_id: int, conn=Depends(get_db)):
    """Ingresó el cliente: la reserva pasa a en curso y la mesa queda ocupada."""
    return await service.registrar_llegada(conn, reserva_id)


@router.post("/{reserva_id}/cobro", response_model=PagoOut, status_code=status.HTTP_201_CREATED)
async def cobrar(reserva_id: int, datos: CobroIn, user=Depends(require_admin), conn=Depends(get_db)):
    """Entró el dinero: se registra el pago, la reserva se completa y la mesa queda libre."""
    return await pagos_service.cobrar(conn, user, reserva_id, datos)


@router.get("/{reserva_id}/pedido", response_model=PedidoOut)
async def ver_pedido(reserva_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    """Comida elegida del menú y total a pagar."""
    return await pedidos_service.obtener(conn, user, reserva_id)


@router.put("/{reserva_id}/pedido", response_model=PedidoOut)
async def guardar_pedido(reserva_id: int, datos: PedidoIn, user=Depends(get_current_user), conn=Depends(get_db)):
    """Reemplaza el pedido de comida (lista vacía = sin pedido)."""
    return await pedidos_service.guardar(conn, user, reserva_id, datos)


@router.patch("/{reserva_id}/servicio", response_model=ReservaOut)
async def elegir_servicio(reserva_id: int, datos: ServicioIn, user=Depends(get_current_user), conn=Depends(get_db)):
    """Cuándo quiere recibir la comida: al entrar, 10 o 20 minutos después, o a una hora personalizada."""
    return await pedidos_service.fijar_servicio(conn, user, reserva_id, datos)


@router.delete("/{reserva_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def eliminar(reserva_id: int, conn=Depends(get_db)):
    await service.eliminar(conn, reserva_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
