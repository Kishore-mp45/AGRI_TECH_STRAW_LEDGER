"""
app/modules/operators/router.py

Pyrolysis Operator Dashboard REST API endpoints.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.modules.operators.service import get_operator_dashboard
from app.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/operators", tags=["Pyrolysis Operators"])


@router.get(
    "/dashboard",
    summary="Pyrolysis Operator Dashboard",
    description=(
        "Returns the complete operational picture: feedstock availability, "
        "routing aggregation, carbon potential, economics, and MRV status."
    ),
)
def operator_dashboard(db: Session = Depends(get_db)):
    try:
        data = get_operator_dashboard(db)
        return success_response(
            data=data.model_dump(),
            message="Operator dashboard data fetched successfully.",
        )
    except Exception:
        logger.exception("Error building operator dashboard")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to build operator dashboard.",
        )


@router.get(
    "/",
    summary="List Pyrolysis Operators",
    description="Returns registered pyrolysis operators.",
)
def list_operators(db: Session = Depends(get_db)):
    from sqlalchemy import text
    sql = text("SELECT id::text, operator_name, contact_email, province FROM pyrolysis_operators WHERE is_active = TRUE ORDER BY operator_name")
    rows = db.execute(sql).mappings().fetchall()
    return success_response(data=[dict(r) for r in rows], message=f"{len(rows)} operators found.")


@router.get(
    "/{item_id}",
    summary="Get Pyrolysis Operator by ID",
    description="Retrieve a single pyrolysis operator record by its UUID.",
)
def get_operator_by_id(item_id: str, db: Session = Depends(get_db)):
    from sqlalchemy import text
    sql = text("SELECT id::text, operator_name, contact_email, province FROM pyrolysis_operators WHERE id = :id")
    row = db.execute(sql, {"id": item_id}).mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Operator '{item_id}' not found.")
    return success_response(data=dict(row), message="Operator found.")