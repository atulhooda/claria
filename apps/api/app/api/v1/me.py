from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.auth import AuthenticatedUser

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=AuthenticatedUser)
async def me(current_user: CurrentUser) -> AuthenticatedUser:
    """Return the validated identity behind the bearer token.

    Verifies that the Clerk JWT round-trip works end-to-end. Once the
    `User` table exists (Step 5), this returns the persisted row instead
    of just the claims.
    """
    return current_user
