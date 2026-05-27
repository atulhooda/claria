from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

DbSession = Annotated[AsyncSession, Depends(get_session)]
"""Use as: `async def route(db: DbSession): ...`"""
