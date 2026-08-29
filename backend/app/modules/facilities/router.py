"""
app/modules/facilities/router.py

Placeholder router for the 'Pyrolysis Facilities' module.
Full business logic will be implemented in later phases.
"""
import logging
from fastapi import APIRouter

from app.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/facilities",
    tags=["Pyrolysis Facilities"],
)


@router.get(
    "/",
    summary="List Pyrolysis Facilities",
    description="Manage pyrolysis facilities. Returns a placeholder response — full implementation in a future phase.",
)
def list_facilities():
    logger.info("GET /facilities/ called")
    return success_response(
        data=[],
        message="Pyrolysis Facilities endpoint is registered. Full implementation coming in a future phase.",
    )


@router.get(
    "/{item_id}",
    summary="Get Pyrolysis Facilities by ID",
    description="Retrieve a single Pyrolysis Facilities record by its UUID.",
)
def get_facilities_by_id(item_id: str):
    logger.info("GET /facilities/%s called", item_id)
    return success_response(
        data=None,
        message="Endpoint registered. Full implementation coming in a future phase.",
    )