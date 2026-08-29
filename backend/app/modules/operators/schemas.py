"""
app/modules/operators/schemas.py

Pydantic schemas for the Pyrolysis Operator Dashboard.
Aggregates data across straw batches, routing, calculation, and MRV modules.
"""
from typing import List, Optional
from pydantic import BaseModel


class BaseSchema(BaseModel):
    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Section 1 – Feedstock
# ---------------------------------------------------------------------------

class ZoneFeedstockBreakdown(BaseSchema):
    zone_id: str
    zone_code: str
    zone_name: str
    province: Optional[str]
    batch_count: int
    total_straw_ton: float


class FeedstockSummary(BaseSchema):
    total_registered_batches: int
    total_available_batches: int   # status = 'registered' or 'pending'
    total_straw_volume_ton: float
    by_zone: List[ZoneFeedstockBreakdown]


# ---------------------------------------------------------------------------
# Section 2 – Routing
# ---------------------------------------------------------------------------

class ZoneRoutingDetail(BaseSchema):
    zone_id: str
    zone_code: str
    zone_name: str
    province: Optional[str]
    assigned_batch_count: int
    aggregated_straw_ton: float
    facility_name: Optional[str]
    facility_code: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]


class RoutingSummary(BaseSchema):
    total_assigned_batches: int
    total_routed_straw_ton: float
    zones: List[ZoneRoutingDetail]


# ---------------------------------------------------------------------------
# Section 3 – Carbon
# ---------------------------------------------------------------------------

class CarbonSummary(BaseSchema):
    total_biochar_ton: float
    total_co2e_ton: float
    avg_biochar_yield_pct: float
    calculated_batch_count: int


# ---------------------------------------------------------------------------
# Section 4 – Economics
# ---------------------------------------------------------------------------

class EconomicsSummary(BaseSchema):
    total_gross_value_usd: float
    total_production_cost_usd: float
    total_margin_pool_usd: float
    total_farmer_payout_usd: float
    avg_farmer_payout_usd: float


# ---------------------------------------------------------------------------
# Section 5 – MRV
# ---------------------------------------------------------------------------

class MRVSummary(BaseSchema):
    total_records: int
    pending: int
    verified: int
    rejected: int


# ---------------------------------------------------------------------------
# Batch status breakdown (for pie chart)
# ---------------------------------------------------------------------------

class BatchStatusBreakdown(BaseSchema):
    status: str
    count: int


# ---------------------------------------------------------------------------
# Full Dashboard payload
# ---------------------------------------------------------------------------

class OperatorDashboard(BaseSchema):
    feedstock: FeedstockSummary
    routing: RoutingSummary
    carbon: CarbonSummary
    economics: EconomicsSummary
    mrv: MRVSummary
    batch_status_breakdown: List[BatchStatusBreakdown]
