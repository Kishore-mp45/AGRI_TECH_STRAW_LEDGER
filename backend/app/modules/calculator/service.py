"""
app/modules/calculator/service.py

Carbon & Economics Calculator service layer.
All calculation logic lives here — routes only call this service.

Calculation chain:
  Straw -> Collected Straw -> Biochar -> CO2e -> Gross Value
  -> Production Cost -> Margin Pool -> Farmer Payout
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.constants import CONSTANTS
from app.modules.calculator.schemas import (
    AggregateResult,
    BatchCalculationResponse,
    BatchSummary,
    CalculationOutput,
    PlatformTotals,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# Pure calculation engine — no DB, no side effects
# ===========================================================================

def run_calculation(straw_volume_ton: float) -> CalculationOutput:
    """
    Apply the MVP calculation chain to a straw volume.
    This is a pure function: same input always produces same output.
    """
    c = CONSTANTS

    collected_straw = round(straw_volume_ton * c.COLLECTION_FRACTION, 4)
    biochar = round(collected_straw * c.BIOCHAR_YIELD, 4)
    co2e = round(biochar * c.CO2_FACTOR, 4)
    gross_value = round(biochar * c.MARKET_VALUE_USD_PER_TON, 2)
    production_cost = round(biochar * c.PRODUCTION_COST_USD_PER_TON, 2)
    margin_pool = round(gross_value - production_cost, 2)
    farmer_payout = round(margin_pool * c.FARMER_SHARE, 2)
    biochar_yield_pct = round(c.BIOCHAR_YIELD * 100, 2)

    return CalculationOutput(
        straw_volume_ton=round(straw_volume_ton, 4),
        collected_straw_ton=collected_straw,
        collection_fraction_pct=round(c.COLLECTION_FRACTION * 100, 1),
        biochar_yield_ton=biochar,
        biochar_yield_pct=biochar_yield_pct,
        co2e_sequestered_ton=co2e,
        co2_factor=c.CO2_FACTOR,
        gross_value_usd=gross_value,
        production_cost_usd=production_cost,
        margin_pool_usd=margin_pool,
        farmer_payout_usd=farmer_payout,
        market_value_usd_per_ton=c.MARKET_VALUE_USD_PER_TON,
        production_cost_usd_per_ton=c.PRODUCTION_COST_USD_PER_TON,
        farmer_share_pct=round(c.FARMER_SHARE * 100, 1),
        calculation_version=c.VERSION,
    )


# ===========================================================================
# Database-backed operations
# ===========================================================================

def _fetch_batch_row(batch_id: str, db: Session) -> Optional[dict]:
    """Fetch a straw batch with farmer and plot info. Returns None if not found."""
    sql = text("""
        SELECT
            sb.id::text              AS batch_id,
            sb.batch_code,
            sb.straw_volume_ton,
            sb.harvest_date::text    AS harvest_date,
            sb.status,
            f.full_name              AS farmer_name,
            pl.plot_name,
            pl.province
        FROM straw_batches sb
        JOIN farmers f  ON f.id  = sb.farmer_id
        JOIN plot_locations pl ON pl.id = sb.plot_id
        WHERE sb.id = :batch_id
    """)
    row = db.execute(sql, {"batch_id": batch_id}).mappings().fetchone()
    return dict(row) if row else None


def _fetch_stored_result(batch_id: str, db: Session) -> Optional[dict]:
    """Fetch existing calculation result for a batch. Returns None if not found."""
    sql = text("""
        SELECT
            id::text            AS calc_id,
            batch_id::text,
            collected_straw_ton,
            biochar_yield_ton,
            biochar_yield_pct,
            co2e_sequestered_ton,
            gross_value_thb     AS gross_value_usd,
            production_cost_thb AS production_cost_usd,
            margin_pool_thb     AS margin_pool_usd,
            farmer_payout_thb   AS farmer_payout_usd,
            calculation_version,
            calculated_at
        FROM calculation_results
        WHERE batch_id = :batch_id
    """)
    row = db.execute(sql, {"batch_id": batch_id}).mappings().fetchone()
    return dict(row) if row else None


def _upsert_calculation(batch_id: str, result: CalculationOutput, db: Session) -> str:
    """
    Insert or update the calculation result for a batch.
    Returns the stored record's id.
    Note: financial columns use _thb suffix (Phase 2 schema) but store USD in MVP.
    """
    sql = text("""
        INSERT INTO calculation_results (
            batch_id,
            collected_straw_ton,
            biochar_yield_ton,
            biochar_yield_pct,
            co2e_sequestered_ton,
            gross_value_thb,
            production_cost_thb,
            margin_pool_thb,
            farmer_payout_thb,
            calculation_version,
            calculated_at
        ) VALUES (
            :batch_id,
            :collected_straw_ton,
            :biochar_yield_ton,
            :biochar_yield_pct,
            :co2e_sequestered_ton,
            :gross_value_usd,
            :production_cost_usd,
            :margin_pool_usd,
            :farmer_payout_usd,
            :calculation_version,
            NOW()
        )
        ON CONFLICT (batch_id) DO UPDATE SET
            collected_straw_ton  = EXCLUDED.collected_straw_ton,
            biochar_yield_ton    = EXCLUDED.biochar_yield_ton,
            biochar_yield_pct    = EXCLUDED.biochar_yield_pct,
            co2e_sequestered_ton = EXCLUDED.co2e_sequestered_ton,
            gross_value_thb      = EXCLUDED.gross_value_thb,
            production_cost_thb  = EXCLUDED.production_cost_thb,
            margin_pool_thb      = EXCLUDED.margin_pool_thb,
            farmer_payout_thb    = EXCLUDED.farmer_payout_thb,
            calculation_version  = EXCLUDED.calculation_version,
            calculated_at        = NOW()
        RETURNING id::text
    """)
    row = db.execute(sql, {
        "batch_id": batch_id,
        "collected_straw_ton": result.collected_straw_ton,
        "biochar_yield_ton": result.biochar_yield_ton,
        "biochar_yield_pct": result.biochar_yield_pct,
        "co2e_sequestered_ton": result.co2e_sequestered_ton,
        "gross_value_usd": result.gross_value_usd,
        "production_cost_usd": result.production_cost_usd,
        "margin_pool_usd": result.margin_pool_usd,
        "farmer_payout_usd": result.farmer_payout_usd,
        "calculation_version": result.calculation_version,
    }).fetchone()
    db.commit()
    return str(row[0])


# ===========================================================================
# Public service functions (called by router)
# ===========================================================================

def calculate_and_store_batch(batch_id: str, db: Session) -> BatchCalculationResponse:
    """
    1. Fetch straw batch from DB.
    2. Run calculation chain.
    3. Upsert result into calculation_results.
    4. Return full response.
    Raises ValueError if batch not found.
    """
    batch = _fetch_batch_row(batch_id, db)
    if not batch:
        raise ValueError(f"Straw batch '{batch_id}' not found.")

    result = run_calculation(float(batch["straw_volume_ton"]))
    calc_id = _upsert_calculation(batch_id, result, db)

    stored = _fetch_stored_result(batch_id, db)
    calculated_at = stored["calculated_at"] if stored else datetime.now(timezone.utc)

    logger.info(
        "Calculated batch %s: straw=%.3ft biochar=%.3ft co2e=%.3ft payout=$%.2f",
        batch["batch_code"],
        batch["straw_volume_ton"],
        result.biochar_yield_ton,
        result.co2e_sequestered_ton,
        result.farmer_payout_usd,
    )

    return BatchCalculationResponse(
        calc_id=calc_id,
        batch_id=batch["batch_id"],
        batch_code=batch["batch_code"],
        farmer_name=batch["farmer_name"],
        plot_name=batch["plot_name"],
        province=batch["province"],
        harvest_date=str(batch["harvest_date"]),
        batch_status=batch["status"],
        result=result,
        calculated_at=calculated_at,
        is_stored=True,
    )


def get_batch_calculation(batch_id: str, db: Session) -> BatchCalculationResponse:
    """
    Return calculation for a batch.
    If no stored result exists, runs the calculation live (without storing).
    """
    batch = _fetch_batch_row(batch_id, db)
    if not batch:
        raise ValueError(f"Straw batch '{batch_id}' not found.")

    stored = _fetch_stored_result(batch_id, db)
    result = run_calculation(float(batch["straw_volume_ton"]))

    return BatchCalculationResponse(
        calc_id=stored["calc_id"] if stored else None,
        batch_id=batch["batch_id"],
        batch_code=batch["batch_code"],
        farmer_name=batch["farmer_name"],
        plot_name=batch["plot_name"],
        province=batch["province"],
        harvest_date=str(batch["harvest_date"]),
        batch_status=batch["status"],
        result=result,
        calculated_at=stored["calculated_at"] if stored else None,
        is_stored=bool(stored),
    )


def get_aggregate_results(db: Session) -> AggregateResult:
    """Aggregate all stored calculation results from the DB."""
    sql = text("""
        SELECT
            COUNT(*)                    AS batch_count,
            COALESCE(SUM(sb.straw_volume_ton), 0)  AS total_straw_volume_ton,
            COALESCE(SUM(cr.collected_straw_ton), 0)  AS total_collected_straw_ton,
            COALESCE(SUM(cr.biochar_yield_ton), 0)    AS total_biochar_ton,
            COALESCE(SUM(cr.co2e_sequestered_ton), 0) AS total_co2e_ton,
            COALESCE(SUM(cr.gross_value_thb), 0)      AS total_gross_value_usd,
            COALESCE(SUM(cr.production_cost_thb), 0)  AS total_production_cost_usd,
            COALESCE(SUM(cr.margin_pool_thb), 0)      AS total_margin_pool_usd,
            COALESCE(SUM(cr.farmer_payout_thb), 0)    AS total_farmer_payout_usd,
            COALESCE(AVG(cr.biochar_yield_pct), 0)    AS avg_biochar_yield_pct,
            COALESCE(AVG(cr.farmer_payout_thb), 0)    AS avg_farmer_payout_usd
        FROM calculation_results cr
        JOIN straw_batches sb ON sb.id = cr.batch_id
    """)
    row = db.execute(sql).mappings().fetchone()
    r = dict(row)
    return AggregateResult(
        batch_count=int(r["batch_count"]),
        total_straw_volume_ton=float(r["total_straw_volume_ton"]),
        total_collected_straw_ton=float(r["total_collected_straw_ton"]),
        total_biochar_ton=float(r["total_biochar_ton"]),
        total_co2e_ton=float(r["total_co2e_ton"]),
        total_gross_value_usd=float(r["total_gross_value_usd"]),
        total_production_cost_usd=float(r["total_production_cost_usd"]),
        total_margin_pool_usd=float(r["total_margin_pool_usd"]),
        total_farmer_payout_usd=float(r["total_farmer_payout_usd"]),
        avg_biochar_yield_pct=float(r["avg_biochar_yield_pct"]),
        avg_farmer_payout_usd=float(r["avg_farmer_payout_usd"]),
        constants_version=CONSTANTS.VERSION,
    )


def get_platform_totals(db: Session) -> PlatformTotals:
    """Projected totals from all registered batches + actual stored results."""
    proj_sql = text("""
        SELECT
            COUNT(*)                         AS total_registered_batches,
            COALESCE(SUM(straw_volume_ton), 0) AS total_registered_straw_ton
        FROM straw_batches
    """)
    proj = dict(db.execute(proj_sql).mappings().fetchone())

    actual_sql = text("""
        SELECT
            COUNT(*)                             AS total_calculated_batches,
            COALESCE(SUM(cr.biochar_yield_ton), 0)    AS actual_biochar_ton,
            COALESCE(SUM(cr.co2e_sequestered_ton), 0) AS actual_co2e_ton,
            COALESCE(SUM(cr.gross_value_thb), 0)      AS actual_gross_value_usd,
            COALESCE(SUM(cr.farmer_payout_thb), 0)    AS actual_farmer_payout_usd
        FROM calculation_results cr
    """)
    actual = dict(db.execute(actual_sql).mappings().fetchone())

    total_straw = float(proj["total_registered_straw_ton"])
    projected = run_calculation(total_straw) if total_straw > 0 else run_calculation(0)
    total_batches = int(proj["total_registered_batches"])
    calc_batches = int(actual["total_calculated_batches"])

    return PlatformTotals(
        total_registered_batches=total_batches,
        total_calculated_batches=calc_batches,
        total_pending_batches=total_batches - calc_batches,
        total_registered_straw_ton=total_straw,
        projected_biochar_ton=projected.biochar_yield_ton,
        projected_co2e_ton=projected.co2e_sequestered_ton,
        projected_gross_value_usd=projected.gross_value_usd,
        projected_farmer_payout_usd=projected.farmer_payout_usd,
        actual_biochar_ton=float(actual["actual_biochar_ton"]),
        actual_co2e_ton=float(actual["actual_co2e_ton"]),
        actual_gross_value_usd=float(actual["actual_gross_value_usd"]),
        actual_farmer_payout_usd=float(actual["actual_farmer_payout_usd"]),
        constants_version=CONSTANTS.VERSION,
    )