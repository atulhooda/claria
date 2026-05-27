import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AppError
from app.schemas.common import ErrorDetail, ErrorResponse

log = structlog.get_logger()


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _error_payload(*, code: str, message: str, request_id: str | None) -> dict[str, object]:
    return ErrorResponse(
        error=ErrorDetail(code=code, message=message, request_id=request_id),
    ).model_dump(by_alias=True)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        request_id = _request_id(request)
        log.warning("app_error", code=exc.code, message=exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(
                code=exc.code, message=exc.message, request_id=request_id
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = _request_id(request)
        log.warning("validation_error", errors=exc.errors())
        return JSONResponse(
            status_code=422,
            content=_error_payload(
                code="VALIDATION_ERROR",
                message="Request validation failed",
                request_id=request_id,
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        log.exception("unexpected_error")
        return JSONResponse(
            status_code=500,
            content=_error_payload(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred",
                request_id=request_id,
            ),
        )
