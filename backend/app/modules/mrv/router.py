"""
app/modules/mrv/router.py

MRV (Measurement, Reporting & Verification) REST API endpoints.
Business logic is fully delegated to service.py.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.modules.mrv.schemas import MRVGenerateRequest, MRVStatusUpdate
from app.modules.mrv.service import (
    generate_mrv_record,
    get_mrv_by_batch_id,
    get_mrv_by_id,
    get_mrv_ledger,
    update_mrv_status,
)
from app.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mrv", tags=["MRV Records"])


# ---------------------------------------------------------------------------
# POST /mrv/generate/{batch_id}
# ---------------------------------------------------------------------------
@router.post(
    "/generate/{batch_id}",
    summary="Generate MRV record for a batch",
    description=(
        "Creates a new MRV audit record for the given straw batch. "
        "Idempotent — calling this multiple times returns the existing record."
    ),
)
def generate_mrv(
    batch_id: str,
    request: MRVGenerateRequest = MRVGenerateRequest(),
    db: Session = Depends(get_db),
):
    try:
        result = generate_mrv_record(batch_id, request, db)
        return success_response(data=result.model_dump(), message=result.message)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception:
        logger.exception("Error generating MRV record for batch %s", batch_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate MRV record.",
        )


# ---------------------------------------------------------------------------
# GET /mrv/ledger
# ---------------------------------------------------------------------------
@router.get(
    "/ledger",
    summary="List all MRV ledger records",
    description="Returns the full MRV ledger with supply-chain traceability. Optionally filter by status.",
)
def list_mrv_ledger(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: pending | verified | rejected"),
    db: Session = Depends(get_db),
):
    try:
        records = get_mrv_ledger(db, status_filter=status_filter)
        return success_response(
            data=[r.model_dump() for r in records],
            message=f"Retrieved {len(records)} MRV record(s).",
        )
    except Exception:
        logger.exception("Error retrieving MRV ledger")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve MRV ledger.",
        )


# ---------------------------------------------------------------------------
# GET /mrv/batch/{batch_id}
# ---------------------------------------------------------------------------
@router.get(
    "/batch/{batch_id}",
    summary="Get MRV record by batch ID",
    description="Retrieve the MRV audit record associated with a specific straw batch.",
)
def get_mrv_for_batch(batch_id: str, db: Session = Depends(get_db)):
    try:
        record = get_mrv_by_batch_id(batch_id, db)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No MRV record found for batch '{batch_id}'.",
            )
        return success_response(data=record.model_dump(), message="MRV record retrieved.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error retrieving MRV for batch %s", batch_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve MRV record.",
        )


# ---------------------------------------------------------------------------
# GET /mrv/{mrv_id}
# ---------------------------------------------------------------------------
@router.get(
    "/{mrv_id}",
    summary="Get MRV record by MRV ID",
    description="Retrieve a specific MRV audit record by its unique MRV record UUID.",
)
def get_mrv(mrv_id: str, db: Session = Depends(get_db)):
    try:
        record = get_mrv_by_id(mrv_id, db)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"MRV record '{mrv_id}' not found.",
            )
        return success_response(data=record.model_dump(), message="MRV record retrieved.")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error retrieving MRV record %s", mrv_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve MRV record.",
        )


# ---------------------------------------------------------------------------
# PATCH /mrv/{mrv_id}/status
# ---------------------------------------------------------------------------
@router.patch(
    "/{mrv_id}/status",
    summary="Update MRV verification status",
    description="Update the verification status of an MRV record (pending → verified | rejected).",
)
def patch_mrv_status(
    mrv_id: str,
    payload: MRVStatusUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = update_mrv_status(mrv_id, payload, db)
        return success_response(
            data=updated.model_dump(),
            message=f"MRV record status updated to '{payload.status}'.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception:
        logger.exception("Error updating MRV status for %s", mrv_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update MRV status.",
        )