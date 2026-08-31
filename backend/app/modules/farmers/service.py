import logging
import re
import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.modules.farmers.schemas import FarmerOnboardRequest, FarmerOnboardResponse

logger = logging.getLogger(__name__)

def _normalize_phone_number(raw_phone: str) -> str:
    cleaned = re.sub(r"[^0-9+]", "", (raw_phone or "").strip())
    digits = cleaned.replace("+", "")
    if not digits:
        return cleaned
    if digits.startswith("84"):
        return "+" + digits
    if digits.startswith("0"):
        return "+84" + digits[1:]
    return "+" + digits


def onboard_farmer(payload: FarmerOnboardRequest, db: Session) -> FarmerOnboardResponse:
    farmer_id = str(uuid.uuid4())
    plot_id = str(uuid.uuid4())
    batch_id = str(uuid.uuid4())

    year = datetime.now().year
    batch_code = f"SB-{year}-{str(uuid.uuid4())[:8].upper()}"

    normalized_phone = _normalize_phone_number(payload.phone_number)
    province = (payload.province or "").strip()
    district_value = (payload.district or province or "Unknown").strip() or province
    state_value = (payload.state or province or "Unknown").strip() or province

    sql_farmer = text("""
        INSERT INTO farmers (id, full_name, phone_number, national_id, village, district, province, created_at, updated_at)
        VALUES (:id, :full_name, :phone_number, :national_id, :village, :district, :province, NOW(), NOW())
    """)

    sql_plot = text("""
        INSERT INTO plot_locations (id, farmer_id, plot_name, area_rai, latitude, longitude, district, province, created_at, updated_at)
        VALUES (:id, :farmer_id, :plot_name, :area_rai, :latitude, :longitude, :district, :province, NOW(), NOW())
    """)

    sql_batch = text("""
        INSERT INTO straw_batches (id, batch_code, farmer_id, plot_id, straw_volume_ton, harvest_date, status, created_at, updated_at)
        VALUES (:id, :batch_code, :farmer_id, :plot_id, :straw_volume_ton, :harvest_date, 'registered', NOW(), NOW())
    """)

    db.execute(sql_farmer, {
        "id": farmer_id,
        "full_name": payload.full_name,
        "phone_number": normalized_phone,
        "national_id": payload.national_id,
        "village": payload.village,
        "district": district_value,
        "province": province
    })

    db.execute(sql_plot, {
        "id": plot_id,
        "farmer_id": farmer_id,
        "plot_name": payload.plot_name,
        "area_rai": payload.plot_area_acres,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "district": district_value,
        "province": province
    })

    db.execute(sql_batch, {
        "id": batch_id,
        "batch_code": batch_code,
        "farmer_id": farmer_id,
        "plot_id": plot_id,
        "straw_volume_ton": payload.straw_volume_ton,
        "harvest_date": payload.harvest_date
    })

    return FarmerOnboardResponse(
        farmer_id=farmer_id,
        plot_id=plot_id,
        batch_id=batch_id,
        batch_code=batch_code,
        status="registered"
    )
