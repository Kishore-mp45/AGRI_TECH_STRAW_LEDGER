"""
app/schemas/common.py

Shared Pydantic schemas and base models reused across multiple modules.
"""
from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

DataT = TypeVar("DataT")


class BaseSchema(BaseModel):
    """Base schema with shared configuration for all Straw Ledger schemas."""
    model_config = ConfigDict(
        from_attributes=True,   # Allow ORM model -> schema conversion
        populate_by_name=True,
    )


class PaginationParams(BaseModel):
    """Common query parameters for paginated list endpoints."""
    page: int = 1
    page_size: int = 20

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel, Generic[DataT]):
    """Generic paginated response wrapper."""
    items: List[DataT]
    total: int
    page: int
    page_size: int
    pages: int


class UUIDSchema(BaseSchema):
    """Mixin for schemas that have a UUID primary key."""
    id: UUID


class TimestampSchema(BaseSchema):
    """Mixin for schemas with created_at / updated_at timestamps."""
    created_at: datetime
    updated_at: Optional[datetime] = None