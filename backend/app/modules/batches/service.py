"""
app/modules/batches/service.py

Service functions for straw batch data retrieval.
"""
import logging
from typing import List

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.calculator.schemas import BatchSummary

logger = logging.getLogger(__name__)


def list_batches_with_calculations(db: Session) -> List[BatchSummary]:
    """
    Return all registered straw batches with their calculation status.
    Includes pre-calculated values if a stored result exists.
    """
    sql = text("""
        SELECT
            sb.id::text             AS batch_id,
            sb.batch_code,
            sb.straw_volume_ton,
            sb.harvest_date::text   AS harvest_date,
            sb.status,
            f.full_name             AS farmer_name,
            pl.plot_name,
            pl.province,
            pl.latitude,
            pl.longitude,
            CASE WHEN cr.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_calculation,
            cr.biochar_yield_ton,
            cr.co2e_sequestered_ton,
            cr.farmer_payout_thb    AS farmer_payout_usd
        FROM straw_batches sb
        JOIN farmers f      ON f.id  = sb.farmer_id
        JOIN plot_locations pl ON pl.id = sb.plot_id
        LEFT JOIN calculation_results cr ON cr.batch_id = sb.id
        ORDER BY sb.harvest_date DESC, sb.created_at DESC
    """)
    rows = db.execute(sql).mappings().fetchall()

    return [
        BatchSummary(
            batch_id=str(r["batch_id"]),
            batch_code=r["batch_code"],
            farmer_name=r["farmer_name"],
            plot_name=r["plot_name"],
            province=r["province"],
            latitude=float(r["latitude"]) if r["latitude"] is not None else None,
            longitude=float(r["longitude"]) if r["longitude"] is not None else None,
            harvest_date=str(r["harvest_date"]),
            straw_volume_ton=float(r["straw_volume_ton"]),
            status=r["status"],
            has_calculation=bool(r["has_calculation"]),
            biochar_yield_ton=float(r["biochar_yield_ton"]) if r["biochar_yield_ton"] is not None else None,
            co2e_sequestered_ton=float(r["co2e_sequestered_ton"]) if r["co2e_sequestered_ton"] is not None else None,
            farmer_payout_usd=float(r["farmer_payout_usd"]) if r["farmer_payout_usd"] is not None else None,
        )
        for r in rows
    ]