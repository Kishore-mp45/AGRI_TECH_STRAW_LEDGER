"""
app/modules/calculator/router.py

Calculator REST API endpoints.
All business logic is delegated to the service layer.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.constants import CONSTANTS
from app.database.connection import get_db
from app.modules.calculator.service import (
    calculate_and_store_batch,
    get_aggregate_results,
    get_batch_calculation,
    get_platform_totals,
    run_calculation,
)
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/calculator", tags=["Calculator"])


@router.get(
    "/constants",
    summary="Get MVP calculation constants",
    description="Returns the current MVP constants used for all calculations.",
)
def get_constants():
    return success_response(
        data={
            "collection_fraction_pct": CONSTANTS.COLLECTION_FRACTION * 100,
            "biochar_yield_pct": CONSTANTS.BIOCHAR_YIELD * 100,
            "co2_factor_t_per_t_biochar": CONSTANTS.CO2_FACTOR,
            "market_value_usd_per_ton": CONSTANTS.MARKET_VALUE_USD_PER_TON,
            "production_cost_usd_per_ton": CONSTANTS.PRODUCTION_COST_USD_PER_TON,
            "farmer_share_pct": CONSTANTS.FARMER_SHARE * 100,
            "version": CONSTANTS.VERSION,
        },
        message="MVP calculation constants.",
    )


@router.post(
    "/batch/{batch_id}",
    summary="Calculate and store results for a batch",
    description=(
        "Fetches the registered straw batch, runs the full calculation chain, "
        "and stores (or updates) the result in calculation_results."
    ),
)
def calculate_batch(batch_id: str, db: Session = Depends(get_db)):
    try:
        result = calculate_and_store_batch(batch_id, db)
        return success_response(
            data=result.model_dump(),
            message=f"Calculation complete for batch {result.batch_code}.",
        )
    except ValueError as exc:
        logger.warning("Batch not found: %s", exc)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error calculating batch %s", batch_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Calculation failed. Please try again.",
        )


@router.get(
    "/batch/{batch_id}",
    summary="Get calculation for a specific batch",
    description=(
        "Returns the calculation result for a registered batch. "
        "If no stored result exists, runs the calculation live without persisting."
    ),
)
def get_batch_result(batch_id: str, db: Session = Depends(get_db)):
    try:
        result = get_batch_calculation(batch_id, db)
        return success_response(
            data=result.model_dump(),
            message=(
                f"Stored result for batch {result.batch_code}."
                if result.is_stored
                else f"Live calculation for batch {result.batch_code} (not yet stored)."
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Error fetching batch result %s", batch_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve result.")


@router.get(
    "/aggregate",
    summary="Aggregate results across all stored calculations",
    description="Returns summed and averaged metrics across all batches that have stored results.",
)
def aggregate_results(db: Session = Depends(get_db)):
    try:
        result = get_aggregate_results(db)
        return success_response(
            data=result.model_dump(),
            message=f"Aggregated results across {result.batch_count} stored batch(es).",
        )
    except Exception as exc:
        logger.exception("Error computing aggregate results")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to compute aggregate.")


@router.get(
    "/totals",
    summary="Platform-wide totals",
    description=(
        "Returns both projected totals (from all registered batch straw volumes) "
        "and actual totals (from stored calculation results)."
    ),
)
def platform_totals(db: Session = Depends(get_db)):
    try:
        result = get_platform_totals(db)
        return success_response(
            data=result.model_dump(),
            message="Platform-level projected and actual totals.",
        )
    except Exception as exc:
        logger.exception("Error computing platform totals")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to compute totals.")