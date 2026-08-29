"""
app/modules/routing/router.py

Routing module REST endpoints.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.database.connection import get_db
from app.modules.routing.schemas import RoutingAssignmentCreate
from app.modules.routing.service import (
    create_assignments, 
    find_best_route, 
    get_feedstock_flow_visualization
)
from app.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/routing", tags=["Routing Assignments"])

@router.get(
    "/flow-visualization",
    summary="Get Feedstock Flow Ecosystem Data",
    description="Returns a holistic geographic dataset of facilities, zones, and routed plots for map visualization.",
)
def get_flow_visualization(db: Session = Depends(get_db)):
    try:
        data = get_feedstock_flow_visualization(db)
        return success_response(
            data=data.model_dump(),
            message="Ecosystem flow fetched."
        )
    except Exception as exc:
        logger.exception("Error fetching flow visualization data")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch feedstock flow visualization."
        )

@router.get(
    "/analyze/{batch_id}",
    summary="Analyze geography for feedstock routing",
    description="Analyzes the target batch, finds nearby batches to form a group, and recommends a route.",
)
def analyze_routing(batch_id: str, db: Session = Depends(get_db)):
    try:
        recommendation = find_best_route(batch_id, db)
        return success_response(
            data=recommendation.model_dump(),
            message="Geographic analysis complete."
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.exception("Error during geographic analysis for batch %s", batch_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze routing geography."
        )

@router.post(
    "/assign",
    summary="Create routing assignments for a group of batches",
    description="Commits the routing recommendation to the database.",
)
def assign_routing(assignment: RoutingAssignmentCreate, db: Session = Depends(get_db)):
    try:
        count = create_assignments(assignment, db)
        return success_response(
            data={"assigned_count": count},
            message=f"Successfully created {count} routing assignment(s)."
        )
    except Exception as exc:
        logger.exception("Error creating routing assignments")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create routing assignments."
        )

@router.get(
    "/",
    summary="List Routing Assignments",
    description="Placeholder — full list endpoint coming in Phase 4.",
)
def list_routing():
    return success_response(
        data=[],
        message="Routing endpoint is registered. Full list coming in a future phase.",
    )

@router.get(
    "/{item_id}",
    summary="Get Routing Assignment by ID",
    description="Retrieve a single Routing Assignments record by its UUID.",
)
def get_routing_by_id(item_id: str):
    return success_response(
        data=None,
        message="Endpoint registered. Full implementation coming in a future phase.",
    )