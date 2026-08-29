"""
app/modules/farmers/router.py

Placeholder router for the 'Farmers' module.
Full business logic will be implemented in later phases.
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.utils.response import success_response
from app.modules.farmers.schemas import FarmerOnboardRequest, FarmerOnboardResponse
from app.modules.farmers.service import onboard_farmer

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/farmers",
    tags=["Farmers"],
)


@router.post(
    "/onboard",
    summary="Onboard a Farmer",
    description="Registers a new farmer, their plot location, and creates their first straw batch.",
    response_model=dict,
)
def onboard(payload: FarmerOnboardRequest, db: Session = Depends(get_db)):
    logger.info("POST /farmers/onboard called")
    result = onboard_farmer(payload, db)
    return success_response(
        data=result.model_dump(),
        message="Farmer onboarded successfully.",
    )

@router.get(
    "/",
    summary="List Farmers",
    description="Manage registered farmers. Returns a placeholder response — full implementation in a future phase.",
)
def list_farmers():
    logger.info("GET /farmers/ called")
    return success_response(
        data=[],
        message="Farmers endpoint is registered. Full implementation coming in a future phase.",
    )


@router.get(
    "/{item_id}",
    summary="Get Farmers by ID",
    description="Retrieve a single Farmers record by its UUID.",
)
def get_farmers_by_id(item_id: str):
    logger.info("GET /farmers/%s called", item_id)
    return success_response(
        data=None,
        message="Endpoint registered. Full implementation coming in a future phase.",
    )