class AppError(Exception):
    """Base class for domain errors.

    Services raise these. The HTTP layer (api/errors.py) translates them
    to status codes + JSON. Business logic stays framework-agnostic.
    """

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        self.message = message
        if code is not None:
            self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class ExternalServiceError(AppError):
    """Raised when an upstream dependency (OpenAI, Clerk, R2) fails."""

    status_code = 502
    code = "EXTERNAL_SERVICE_ERROR"
