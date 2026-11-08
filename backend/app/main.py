"""Punto de entrada de la API. Ejecutar con: uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import close_pool, init_pool
from app.core.exceptions import AppError
from app.routers import auth, mesas, pagos, pedidos, platos, reportes, reservas, restaurantes, usuarios


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(title="API de Reservas de Restaurante", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def manejar_error_de_dominio(_: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


for router in (
    auth.router, usuarios.router, restaurantes.router, mesas.router, platos.router, pedidos.router,
    reservas.router, pagos.router, reportes.router,
):
    app.include_router(router)


@app.get("/health", tags=["Sistema"])
async def health():
    return {"status": "ok"}
