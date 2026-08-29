"""
app/utils/response.py

Reusable API response wrapper for all endpoints.
Provides a consistent JSON envelope: { success, data, message, errors }.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    """Standard API response envelope."""
    success: bool
    message: str
    data: Optional[Any] = None
    errors: Optional[List[Dict[str, Any]]] = None


def success_response(
    data: Any = None,
    message: str = "Request successful.",
) -> Dict[str, Any]:
    """Build a standard success response dict."""
    return APIResponse(
        success=True,
        message=message,
        data=data,
        errors=None,
    ).model_dump()


def error_response(
    message: str = "An error occurred.",
    errors: Optional[List[Dict[str, Any]]] = None,
    data: Any = None,
) -> Dict[str, Any]:
    """Build a standard error response dict."""
    return APIResponse(
        success=False,
        message=message,
        data=data,
        errors=errors or [],
    ).model_dump()