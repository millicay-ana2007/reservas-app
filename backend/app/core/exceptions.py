"""Excepciones de dominio. Los routers no arman respuestas HTTP a mano:
las capas inferiores lanzan estas excepciones y main.py las traduce."""


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str):
        self.detail = detail


class UnauthorizedError(AppError):
    status_code = 401


class ForbiddenError(AppError):
    status_code = 403


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409
