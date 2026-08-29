"""
app/modules/batches/router.py

REST API endpoints for straw batch data.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.modules.batches.service import list_batches_with_calculations
from app.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/batches", tags=["Straw Batches"])


@router.get(
    "/",
    summary="List all straw batches",
    description=(
        "Returns all registered straw batches with farmer, plot, and "
        "calculation status information."
    ),
)
def list_batches(db: Session = Depends(get_db)):
    try:
        batches = list_batches_with_calculations(db)
        return success_response(
            data=[b.model_dump() for b in batches],
            message=f"{len(batches)} straw batch(es) found.",
        )
    except Exception as exc:
        logger.exception("Error listing batches")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve batches.",
        )


@router.get(
    "/{item_id}",
    summary="Get straw batch by ID",
    description="Placeholder — full single-batch detail endpoint coming in Phase 4.",
)
def get_batch_by_id(item_id: str):
    return success_response(
        data=None,
        message="Single batch detail — Phase 4 implementation.",
    )