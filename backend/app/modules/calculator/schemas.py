"""
app/modules/calculator/schemas.py

Pydantic schemas for the calculator module.
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from app.schemas.common import BaseSchema
from app.config.constants import CONSTANTS


class CalculationOutput(BaseSchema):
    """
    The complete result of a single batch calculation.
    Financial values are in USD.
    """
    # Input
    straw_volume_ton: float

    # Calculation chain
    collected_straw_ton: float
    collection_fraction_pct: float

    biochar_yield_ton: float
    biochar_yield_pct: float

    co2e_sequestered_ton: float
    co2_factor: float

    # Economics (USD)
    gross_value_usd: float
    production_cost_usd: float
    margin_pool_usd: float
    farmer_payout_usd: float

    # Rates used
    market_value_usd_per_ton: float
    production_cost_usd_per_ton: float
    farmer_share_pct: float

    # Version
    calculation_version: str


class BatchCalculationResponse(BaseSchema):
    """Full calculation result for a registered batch."""
    calc_id: Optional[str] = None
    batch_id: str
    batch_code: str
    farmer_name: str
    plot_name: str
    province: str
    harvest_date: str
    batch_status: str
    result: CalculationOutput
    calculated_at: Optional[datetime] = None
    is_stored: bool = False


class BatchSummary(BaseSchema):
    """Lightweight summary of a straw batch for listing."""
    batch_id: str
    batch_code: str
    farmer_name: str
    plot_name: str
    province: str
    harvest_date: str
    straw_volume_ton: float
    status: str
    has_calculation: bool
    # Optional pre-calculated values if already stored
    biochar_yield_ton: Optional[float] = None
    co2e_sequestered_ton: Optional[float] = None
    farmer_payout_usd: Optional[float] = None


class AggregateResult(BaseSchema):
    """Aggregated results across multiple stored calculation records."""
    batch_count: int
    total_straw_volume_ton: float
    total_collected_straw_ton: float
    total_biochar_ton: float
    total_co2e_ton: float
    total_gross_value_usd: float
    total_production_cost_usd: float
    total_margin_pool_usd: float
    total_farmer_payout_usd: float
    # Averages
    avg_biochar_yield_pct: float
    avg_farmer_payout_usd: float
    # Constants used
    constants_version: str


class PlatformTotals(BaseSchema):
    """Platform-wide totals derived from all registered batches (with or without stored results)."""
    total_registered_batches: int
    total_calculated_batches: int
    total_pending_batches: int
    # Based on registered straw volumes (projected)
    total_registered_straw_ton: float
    projected_biochar_ton: float
    projected_co2e_ton: float
    projected_gross_value_usd: float
    projected_farmer_payout_usd: float
    # Based on stored calculation results (actual)
    actual_biochar_ton: float
    actual_co2e_ton: float
    actual_gross_value_usd: float
    actual_farmer_payout_usd: float
    constants_version: str