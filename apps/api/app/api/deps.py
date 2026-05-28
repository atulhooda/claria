from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.db.session import get_session
from app.integrations.clerk import ClerkVerifier, get_clerk_verifier
from app.schemas.auth import AuthenticatedUser

DbSession = Annotated[AsyncSession, Depends(get_session)]
"""Use as: `async def route(db: DbSession): ...`"""


BYPASS_USER = AuthenticatedUser(id="user_dev_bypass", session_id="sess_dev_bypass")
"""Synthetic identity returned when `Settings.auth_bypass_enabled` is True."""


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise UnauthorizedError("missing authorization header", code="UNAUTHORIZED")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError(
            "authorization header must be 'Bearer <token>'", code="UNAUTHORIZED"
        )
    return token


def authenticate_token(token: str | None, verifier: ClerkVerifier) -> AuthenticatedUser:
    """Validate a raw Clerk JWT (no header parsing) and return the user.

    Shared by HTTP and WebSocket entrypoints. WebSocket upgrades can't
    carry an `Authorization` header from the browser, so they pass the
    token as a query parameter and call this directly.

    Raises:
        UnauthorizedError: token missing, malformed, or invalid.
    """
    if get_settings().auth_bypass_enabled:
        return BYPASS_USER

    if not token:
        raise UnauthorizedError("missing token", code="UNAUTHORIZED")

    claims = verifier.verify(token)
    user_id = claims.get("sub")
    session_id = claims.get("sid")
    if not isinstance(user_id, str) or not user_id:
        raise UnauthorizedError("token is missing `sub` claim", code="INVALID_TOKEN")
    if not isinstance(session_id, str) or not session_id:
        raise UnauthorizedError("token is missing `sid` claim", code="INVALID_TOKEN")
    return AuthenticatedUser(id=user_id, session_id=session_id)


def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    verifier: Annotated[ClerkVerifier, Depends(get_clerk_verifier)] = ...,  # type: ignore[assignment]
) -> AuthenticatedUser:
    """Validate the incoming Clerk JWT and return the caller's identity.

    Routes opt in by adding `current_user: CurrentUser` to their signature.
    Public routes simply omit the dependency. In bypass mode the bearer
    header is ignored entirely.
    """
    if get_settings().auth_bypass_enabled:
        return BYPASS_USER
    token = _extract_bearer_token(authorization)
    return authenticate_token(token, verifier)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
"""Use as: `async def route(user: CurrentUser): ...`"""
