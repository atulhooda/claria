from app.schemas.common import BaseSchema


class AuthenticatedUser(BaseSchema):
    """The validated identity behind a Clerk session token.

    Today these are the only claims we trust from a default Clerk session
    token. Email/name will come from the application's `User` row once
    the database schema lands (Step 5 in the implementation plan).
    """

    id: str
    session_id: str
