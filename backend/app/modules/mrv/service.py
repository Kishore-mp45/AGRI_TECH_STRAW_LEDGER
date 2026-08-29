"""
app/modules/mrv/service.py

MRV (Measurement, Reporting & Verification) service layer.
All business logic lives here — routes only call these functions.

Principle:
  Onboarding + Routing + Calculation → MRV Ledger Record

The service generates a single structured, traceable audit record that
brings together farmer, plot, batch, routing, and calculation data
without duplicating source tables.
"""
import logging
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.mrv.schemas import (
    MRVCalculationDetail,
    MRVGenerateRequest,
    MRVGenerateResponse,
    MRVLedgerRecord,
    MRVRoutingDetail,
    MRVStatusUpdate,
)

logger = logging.getLogger(__name__)

_VALID_STATUSES = {"pending", "verified", "rejected"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch_batch_prereqs(batch_id: str, db: Session) -> Optional[dict]:
    """
    Verify the batch exists and retrieve a summary needed to generate MRV.
    Returns None if batch not found.
    """
    sql = text("""
        SELECT
            sb.id::text          AS batch_id,
            sb.batch_code,
            sb.farmer_id::text,
            sb.plot_id::text,
            sb.straw_volume_ton,
            sb.status
        FROM straw_batches sb
        WHERE sb.id = :batch_id
    """)
    row = db.execute(sql, {"batch_id": batch_id}).mappings().fetchone()
    return dict(row) if row else None


def _fetch_existing_mrv(batch_id: str, db: Session) -> Optional[dict]:
    """Check if an MRV record already exists for this batch."""
    sql = text("""
        SELECT id::text AS mrv_id, mrv_status
        FROM mrv_records
        WHERE batch_id = :batch_id
    """)
    row = db.execute(sql, {"batch_id": batch_id}).mappings().fetchone()
    return dict(row) if row else None


def _has_calculation(batch_id: str, db: Session) -> bool:
    """Return True if a calculation result exists for this batch."""
    sql = text("SELECT 1 FROM calculation_results WHERE batch_id = :bid")
    return db.execute(sql, {"bid": batch_id}).fetchone() is not None


def _has_routing(batch_id: str, db: Session) -> bool:
    """Return True if a routing assignment exists for this batch."""
    sql = text("SELECT 1 FROM routing_assignments WHERE batch_id = :bid")
    return db.execute(sql, {"bid": batch_id}).fetchone() is not None


def _build_ledger_record(row: dict) -> MRVLedgerRecord:
    """Map a raw SQL row dict to the MRVLedgerRecord schema."""
    routing = None
    if row.get("zone_id"):
        routing = MRVRoutingDetail(
            zone_id=row["zone_id"],
            zone_code=row["zone_code"],
            zone_name=row["zone_name"],
            zone_province=row.get("zone_province"),
            facility_id=row["facility_id"],
            facility_code=row["facility_code"],
            facility_name=row["facility_name"],
            distance_km=float(row["distance_km"]) if row.get("distance_km") else None,
            assignment_status=row.get("assignment_status", "scheduled"),
            assigned_at=row.get("assigned_at"),
        )

    calculation = None
    if row.get("calc_id"):
        calculation = MRVCalculationDetail(
            collected_straw_ton=float(row["collected_straw_ton"]),
            biochar_yield_ton=float(row["biochar_yield_ton"]),
            biochar_yield_pct=float(row["biochar_yield_pct"]) if row.get("biochar_yield_pct") else None,
            co2e_sequestered_ton=float(row["co2e_sequestered_ton"]),
            gross_value_usd=float(row["gross_value_usd"]),
            production_cost_usd=float(row["production_cost_usd"]),
            margin_pool_usd=float(row["margin_pool_usd"]),
            farmer_payout_usd=float(row["farmer_payout_usd"]),
            calculation_version=row["calculation_version"],
            calculated_at=row.get("calculated_at"),
        )

    return MRVLedgerRecord(
        mrv_id=row["mrv_id"],
        batch_id=row["batch_id"],
        batch_code=row["batch_code"],
        mrv_status=row["mrv_status"],
        farmer_id=row["farmer_id"],
        farmer_name=row["farmer_name"],
        farmer_phone=row.get("farmer_phone"),
        farmer_province=row.get("farmer_province"),
        plot_id=row["plot_id"],
        plot_name=row["plot_name"],
        plot_province=row.get("plot_province"),
        plot_area_rai=float(row["plot_area_rai"]) if row.get("plot_area_rai") else None,
        plot_latitude=float(row["plot_latitude"]) if row.get("plot_latitude") else None,
        plot_longitude=float(row["plot_longitude"]) if row.get("plot_longitude") else None,
        straw_volume_ton=float(row["straw_volume_ton"]),
        harvest_date=str(row["harvest_date"]) if row.get("harvest_date") else None,
        rice_variety=row.get("rice_variety"),
        moisture_pct=float(row["moisture_pct"]) if row.get("moisture_pct") else None,
        routing=routing,
        calculation=calculation,
        field_officer_name=row.get("field_officer_name"),
        field_verification_date=str(row["field_verification_date"]) if row.get("field_verification_date") else None,
        gps_verified=bool(row.get("gps_verified", False)),
        verified_by=row.get("verified_by"),
        verification_date=str(row["verification_date"]) if row.get("verification_date") else None,
        rejection_reason=row.get("rejection_reason"),
        carbon_credit_ref=row.get("carbon_credit_ref"),
        mrv_created_at=row["mrv_created_at"],
        mrv_updated_at=row["mrv_updated_at"],
    )


# The massive ledger JOIN SQL — assembled once and reused by get_ledger and get_by_id
_LEDGER_SQL = """
    SELECT
        -- MRV Record
        mrv.id::text                    AS mrv_id,
        mrv.mrv_status,
        mrv.field_officer_name,
        mrv.field_verification_date,
        mrv.gps_verified,
        mrv.verified_by,
        mrv.verification_date,
        mrv.rejection_reason,
        mrv.carbon_credit_ref,
        mrv.notes                       AS mrv_notes,
        mrv.created_at                  AS mrv_created_at,
        mrv.updated_at                  AS mrv_updated_at,

        -- Straw Batch
        sb.id::text                     AS batch_id,
        sb.batch_code,
        sb.straw_volume_ton,
        sb.harvest_date,
        sb.rice_variety,
        sb.moisture_pct,

        -- Farmer
        f.id::text                      AS farmer_id,
        f.full_name                     AS farmer_name,
        f.phone_number                  AS farmer_phone,
        f.province                      AS farmer_province,

        -- Plot
        pl.id::text                     AS plot_id,
        pl.plot_name,
        pl.province                     AS plot_province,
        pl.area_rai                     AS plot_area_rai,
        pl.latitude                     AS plot_latitude,
        pl.longitude                    AS plot_longitude,

        -- Routing (LEFT JOIN — may not exist)
        cz.id::text                     AS zone_id,
        cz.zone_code,
        cz.zone_name,
        cz.province                     AS zone_province,
        pf.id::text                     AS facility_id,
        pf.facility_code,
        pf.facility_name,
        ra.distance_km,
        ra.assignment_status,
        ra.assigned_at,

        -- Calculation (LEFT JOIN — may not exist)
        cr.id::text                     AS calc_id,
        cr.collected_straw_ton,
        cr.biochar_yield_ton,
        cr.biochar_yield_pct,
        cr.co2e_sequestered_ton,
        cr.gross_value_thb              AS gross_value_usd,
        cr.production_cost_thb          AS production_cost_usd,
        cr.margin_pool_thb              AS margin_pool_usd,
        cr.farmer_payout_thb            AS farmer_payout_usd,
        cr.calculation_version,
        cr.calculated_at

    FROM mrv_records mrv
    JOIN straw_batches sb ON sb.id = mrv.batch_id
    JOIN farmers f        ON f.id  = sb.farmer_id
    JOIN plot_locations pl ON pl.id = sb.plot_id
    LEFT JOIN routing_assignments ra ON ra.batch_id = sb.id
    LEFT JOIN collection_zones cz    ON cz.id = ra.collection_zone_id
    LEFT JOIN pyrolysis_facilities pf ON pf.id = ra.facility_id
    LEFT JOIN calculation_results cr  ON cr.batch_id = sb.id
"""


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def generate_mrv_record(
    batch_id: str,
    request: MRVGenerateRequest,
    db: Session,
) -> MRVGenerateResponse:
    """
    Create an MRV record for a given batch.
    - Validates batch exists.
    - Warns if routing or calculation are missing (but proceeds with pending status).
    - Idempotent: if MRV already exists, returns existing record info.
    """
    batch = _fetch_batch_prereqs(batch_id, db)
    if not batch:
        raise ValueError(f"Straw batch '{batch_id}' not found.")

    # Idempotency — don't create duplicates
    existing = _fetch_existing_mrv(batch_id, db)
    if existing:
        logger.info("MRV record already exists for batch %s (mrv_id=%s)", batch_id, existing["mrv_id"])
        return MRVGenerateResponse(
            mrv_id=existing["mrv_id"],
            batch_id=batch_id,
            batch_code=batch["batch_code"],
            mrv_status=existing["mrv_status"],
            message="MRV record already exists for this batch.",
        )

    has_calc = _has_calculation(batch_id, db)
    has_route = _has_routing(batch_id, db)
    if not has_calc:
        logger.warning("Batch %s has no calculation result — MRV will be created with pending status.", batch_id)
    if not has_route:
        logger.warning("Batch %s has no routing assignment — MRV will be created with pending status.", batch_id)

    insert_sql = text("""
        INSERT INTO mrv_records (
            batch_id,
            field_officer_name,
            field_verification_date,
            gps_verified,
            notes,
            mrv_status
        ) VALUES (
            :batch_id,
            :field_officer_name,
            :field_verification_date,
            :gps_verified,
            :notes,
            'pending'
        )
        RETURNING id::text, mrv_status
    """)
    row = db.execute(insert_sql, {
        "batch_id": batch_id,
        "field_officer_name": request.field_officer_name,
        "field_verification_date": request.field_verification_date,
        "gps_verified": request.gps_verified,
        "notes": request.notes,
    }).fetchone()
    db.commit()

    mrv_id = str(row[0])
    mrv_status = row[1]

    logger.info("Generated MRV record %s for batch %s", mrv_id, batch["batch_code"])

    return MRVGenerateResponse(
        mrv_id=mrv_id,
        batch_id=batch_id,
        batch_code=batch["batch_code"],
        mrv_status=mrv_status,
        message="MRV record generated successfully.",
    )


def get_mrv_ledger(
    db: Session,
    status_filter: Optional[str] = None,
) -> List[MRVLedgerRecord]:
    """
    Retrieve all MRV records with full supply-chain traceability data.
    Optionally filter by mrv_status.
    """
    where_clause = ""
    params: dict = {}
    if status_filter and status_filter in _VALID_STATUSES:
        where_clause = "WHERE mrv.mrv_status = :status"
        params["status"] = status_filter

    sql = text(f"{_LEDGER_SQL} {where_clause} ORDER BY mrv.created_at DESC")
    rows = db.execute(sql, params).mappings().fetchall()
    return [_build_ledger_record(dict(r)) for r in rows]


def get_mrv_by_id(mrv_id: str, db: Session) -> Optional[MRVLedgerRecord]:
    """Retrieve a single MRV record by its MRV UUID."""
    sql = text(f"{_LEDGER_SQL} WHERE mrv.id = :mrv_id")
    row = db.execute(sql, {"mrv_id": mrv_id}).mappings().fetchone()
    return _build_ledger_record(dict(row)) if row else None


def get_mrv_by_batch_id(batch_id: str, db: Session) -> Optional[MRVLedgerRecord]:
    """Retrieve the MRV record for a given straw batch."""
    sql = text(f"{_LEDGER_SQL} WHERE mrv.batch_id = :batch_id")
    row = db.execute(sql, {"batch_id": batch_id}).mappings().fetchone()
    return _build_ledger_record(dict(row)) if row else None


def update_mrv_status(
    mrv_id: str,
    payload: MRVStatusUpdate,
    db: Session,
) -> MRVLedgerRecord:
    """
    Update the verification status of an MRV record.
    Allowed transitions:
      pending → verified | rejected
      rejected → pending (re-open for review)
    """
    if payload.status not in _VALID_STATUSES:
        raise ValueError(f"Invalid status '{payload.status}'. Must be one of: {', '.join(_VALID_STATUSES)}")

    # Fetch existing record first
    existing = get_mrv_by_id(mrv_id, db)
    if not existing:
        raise ValueError(f"MRV record '{mrv_id}' not found.")

    update_sql = text("""
        UPDATE mrv_records SET
            mrv_status            = :status,
            verified_by           = :verified_by,
            verification_date     = CASE WHEN :status = 'verified' THEN NOW()::date ELSE NULL END,
            rejection_reason      = :rejection_reason,
            notes                 = COALESCE(:notes, notes),
            updated_at            = NOW()
        WHERE id = :mrv_id
    """)
    db.execute(update_sql, {
        "mrv_id": mrv_id,
        "status": payload.status,
        "verified_by": payload.verified_by,
        "rejection_reason": payload.rejection_reason,
        "notes": payload.notes,
    })
    db.commit()

    logger.info(
        "MRV %s status updated: %s -> %s (by %s)",
        mrv_id, existing.mrv_status, payload.status, payload.verified_by or "system"
    )

    updated = get_mrv_by_id(mrv_id, db)
    return updated
