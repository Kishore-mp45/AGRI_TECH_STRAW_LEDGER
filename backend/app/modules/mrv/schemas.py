"""
app/modules/mrv/schemas.py

Pydantic schemas for the MRV (Measurement, Reporting & Verification) module.
"""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel


class BaseSchema(BaseModel):
    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class MRVGenerateRequest(BaseSchema):
    """Optional metadata to attach when generating an MRV record."""
    field_officer_name: Optional[str] = None
    field_verification_date: Optional[date] = None
    gps_verified: bool = False
    notes: Optional[str] = None


class MRVStatusUpdate(BaseSchema):
    """Payload for updating verification status."""
    status: str  # pending | verified | rejected
    verified_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class MRVCalculationDetail(BaseSchema):
    collected_straw_ton: float
    biochar_yield_ton: float
    biochar_yield_pct: Optional[float]
    co2e_sequestered_ton: float
    gross_value_usd: float
    production_cost_usd: float
    margin_pool_usd: float
    farmer_payout_usd: float
    calculation_version: str
    calculated_at: Optional[datetime]


class MRVRoutingDetail(BaseSchema):
    zone_id: str
    zone_code: str
    zone_name: str
    zone_province: Optional[str]
    facility_id: str
    facility_code: str
    facility_name: str
    distance_km: Optional[float]
    assignment_status: str
    assigned_at: Optional[datetime]


class MRVLedgerRecord(BaseSchema):
    """Complete, denormalised view of a single MRV record for the ledger."""
    mrv_id: str
    batch_id: str
    batch_code: str
    mrv_status: str

    # Farmer / Source
    farmer_id: str
    farmer_name: str
    farmer_phone: Optional[str]
    farmer_province: Optional[str]

    # Plot
    plot_id: str
    plot_name: str
    plot_province: Optional[str]
    plot_area_rai: Optional[float]
    plot_latitude: Optional[float]
    plot_longitude: Optional[float]

    # Batch / Harvest
    straw_volume_ton: float
    harvest_date: Optional[str]
    rice_variety: Optional[str]
    moisture_pct: Optional[float]

    # Routing
    routing: Optional[MRVRoutingDetail]

    # Calculation
    calculation: Optional[MRVCalculationDetail]

    # Verification metadata
    field_officer_name: Optional[str]
    field_verification_date: Optional[str]
    gps_verified: bool
    verified_by: Optional[str]
    verification_date: Optional[str]
    rejection_reason: Optional[str]
    carbon_credit_ref: Optional[str]

    # Timestamps
    mrv_created_at: datetime
    mrv_updated_at: datetime


class MRVGenerateResponse(BaseSchema):
    mrv_id: str
    batch_id: str
    batch_code: str
    mrv_status: str
    message: str
