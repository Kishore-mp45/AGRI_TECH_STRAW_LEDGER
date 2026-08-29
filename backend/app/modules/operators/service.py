"""
app/modules/operators/service.py

Pyrolysis Operator Dashboard aggregation service.
Pulls data across straw_batches, routing_assignments, collection_zones,
pyrolysis_facilities, calculation_results, and mrv_records using efficient
SQL aggregation queries — no business logic is duplicated.
"""
import logging
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.operators.schemas import (
    BatchStatusBreakdown,
    CarbonSummary,
    EconomicsSummary,
    FeedstockSummary,
    MRVSummary,
    OperatorDashboard,
    RoutingSummary,
    ZoneFeedstockBreakdown,
    ZoneRoutingDetail,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Individual section builders
# ---------------------------------------------------------------------------

def _build_feedstock(db: Session, facility_id: Optional[str] = None) -> FeedstockSummary:
    """Aggregate feedstock availability across all (or a single) facility."""

    # totals
    totals_sql = text("""
        SELECT
            COUNT(*)                           AS total_registered,
            COUNT(*) FILTER (WHERE sb.status IN ('pending','registered','collected'))
                                               AS total_available,
            COALESCE(SUM(sb.straw_volume_ton), 0) AS total_vol
        FROM straw_batches sb
    """)
    r = dict(db.execute(totals_sql).mappings().fetchone())

    # per-zone breakdown via routing_assignments
    zone_sql = text("""
        SELECT
            cz.id::text                              AS zone_id,
            cz.zone_code,
            cz.zone_name,
            cz.province,
            COUNT(ra.batch_id)                       AS batch_count,
            COALESCE(SUM(sb.straw_volume_ton), 0)    AS total_straw_ton
        FROM collection_zones cz
        LEFT JOIN routing_assignments ra ON ra.collection_zone_id = cz.id
        LEFT JOIN straw_batches sb       ON sb.id = ra.batch_id
        WHERE cz.is_active = TRUE
        GROUP BY cz.id, cz.zone_code, cz.zone_name, cz.province
        ORDER BY total_straw_ton DESC
    """)
    zone_rows = db.execute(zone_sql).mappings().fetchall()

    return FeedstockSummary(
        total_registered_batches=int(r["total_registered"]),
        total_available_batches=int(r["total_available"]),
        total_straw_volume_ton=float(r["total_vol"]),
        by_zone=[
            ZoneFeedstockBreakdown(
                zone_id=z["zone_id"],
                zone_code=z["zone_code"],
                zone_name=z["zone_name"],
                province=z.get("province"),
                batch_count=int(z["batch_count"]),
                total_straw_ton=float(z["total_straw_ton"]),
            )
            for z in zone_rows
        ],
    )


def _build_routing(db: Session) -> RoutingSummary:
    totals_sql = text("""
        SELECT
            COUNT(*)                           AS total_assigned,
            COALESCE(SUM(sb.straw_volume_ton), 0) AS total_routed_vol
        FROM routing_assignments ra
        JOIN straw_batches sb ON sb.id = ra.batch_id
    """)
    r = dict(db.execute(totals_sql).mappings().fetchone())

    zone_sql = text("""
        SELECT
            cz.id::text                            AS zone_id,
            cz.zone_code,
            cz.zone_name,
            cz.province,
            cz.center_lat                          AS latitude,
            cz.center_lon                          AS longitude,
            COUNT(ra.batch_id)                     AS assigned_batch_count,
            COALESCE(SUM(sb.straw_volume_ton), 0)  AS aggregated_straw_ton,
            pf.facility_name,
            pf.facility_code
        FROM collection_zones cz
        JOIN routing_assignments ra ON ra.collection_zone_id = cz.id
        JOIN straw_batches sb       ON sb.id = ra.batch_id
        LEFT JOIN pyrolysis_facilities pf ON pf.id = ra.facility_id
        GROUP BY cz.id, cz.zone_code, cz.zone_name, cz.province,
                 cz.center_lat, cz.center_lon, pf.facility_name, pf.facility_code
        ORDER BY aggregated_straw_ton DESC
    """)
    zone_rows = db.execute(zone_sql).mappings().fetchall()

    return RoutingSummary(
        total_assigned_batches=int(r["total_assigned"]),
        total_routed_straw_ton=float(r["total_routed_vol"]),
        zones=[
            ZoneRoutingDetail(
                zone_id=z["zone_id"],
                zone_code=z["zone_code"],
                zone_name=z["zone_name"],
                province=z.get("province"),
                assigned_batch_count=int(z["assigned_batch_count"]),
                aggregated_straw_ton=float(z["aggregated_straw_ton"]),
                facility_name=z.get("facility_name"),
                facility_code=z.get("facility_code"),
                latitude=float(z["latitude"]) if z.get("latitude") else None,
                longitude=float(z["longitude"]) if z.get("longitude") else None,
            )
            for z in zone_rows
        ],
    )


def _build_carbon(db: Session) -> CarbonSummary:
    sql = text("""
        SELECT
            COALESCE(SUM(biochar_yield_ton), 0)    AS total_biochar,
            COALESCE(SUM(co2e_sequestered_ton), 0) AS total_co2e,
            COALESCE(AVG(biochar_yield_pct), 0)    AS avg_yield_pct,
            COUNT(*)                               AS calc_count
        FROM calculation_results
    """)
    r = dict(db.execute(sql).mappings().fetchone())
    return CarbonSummary(
        total_biochar_ton=float(r["total_biochar"]),
        total_co2e_ton=float(r["total_co2e"]),
        avg_biochar_yield_pct=float(r["avg_yield_pct"]),
        calculated_batch_count=int(r["calc_count"]),
    )


def _build_economics(db: Session) -> EconomicsSummary:
    sql = text("""
        SELECT
            COALESCE(SUM(gross_value_thb), 0)      AS total_gross,
            COALESCE(SUM(production_cost_thb), 0)  AS total_cost,
            COALESCE(SUM(margin_pool_thb), 0)      AS total_margin,
            COALESCE(SUM(farmer_payout_thb), 0)    AS total_payout,
            COALESCE(AVG(farmer_payout_thb), 0)    AS avg_payout
        FROM calculation_results
    """)
    r = dict(db.execute(sql).mappings().fetchone())
    return EconomicsSummary(
        total_gross_value_usd=float(r["total_gross"]),
        total_production_cost_usd=float(r["total_cost"]),
        total_margin_pool_usd=float(r["total_margin"]),
        total_farmer_payout_usd=float(r["total_payout"]),
        avg_farmer_payout_usd=float(r["avg_payout"]),
    )


def _build_mrv(db: Session) -> MRVSummary:
    sql = text("""
        SELECT
            COUNT(*)                                          AS total,
            COUNT(*) FILTER (WHERE mrv_status = 'pending')   AS pending,
            COUNT(*) FILTER (WHERE mrv_status = 'verified')  AS verified,
            COUNT(*) FILTER (WHERE mrv_status = 'rejected')  AS rejected
        FROM mrv_records
    """)
    r = dict(db.execute(sql).mappings().fetchone())
    return MRVSummary(
        total_records=int(r["total"]),
        pending=int(r["pending"]),
        verified=int(r["verified"]),
        rejected=int(r["rejected"]),
    )


def _build_batch_status_breakdown(db: Session) -> List[BatchStatusBreakdown]:
    sql = text("""
        SELECT status, COUNT(*) AS count
        FROM straw_batches
        GROUP BY status
        ORDER BY count DESC
    """)
    rows = db.execute(sql).mappings().fetchall()
    return [BatchStatusBreakdown(status=r["status"], count=int(r["count"])) for r in rows]


# ---------------------------------------------------------------------------
# Public service function
# ---------------------------------------------------------------------------

def get_operator_dashboard(db: Session) -> OperatorDashboard:
    """Aggregate all dashboard sections in a single call."""
    logger.info("Building operator dashboard aggregation…")
    feedstock  = _build_feedstock(db)
    routing    = _build_routing(db)
    carbon     = _build_carbon(db)
    economics  = _build_economics(db)
    mrv        = _build_mrv(db)
    breakdown  = _build_batch_status_breakdown(db)

    return OperatorDashboard(
        feedstock=feedstock,
        routing=routing,
        carbon=carbon,
        economics=economics,
        mrv=mrv,
        batch_status_breakdown=breakdown,
    )
