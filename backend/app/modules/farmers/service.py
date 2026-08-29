import logging
import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.modules.farmers.schemas import FarmerOnboardRequest, FarmerOnboardResponse

logger = logging.getLogger(__name__)

def onboard_farmer(payload: FarmerOnboardRequest, db: Session) -> FarmerOnboardResponse:
    farmer_id = str(uuid.uuid4())
    plot_id = str(uuid.uuid4())
    batch_id = str(uuid.uuid4())
    
    # Simple batch code generator (e.g. SB-YYYY-XXXXX)
    year = datetime.now().year
    
    # We can get a random code or try to use a sequence. For simplicity in raw SQL:
    batch_code = f"SB-{year}-{str(uuid.uuid4())[:8].upper()}"

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
        VALUES (:id, :batch_code, :farmer_id, :plot_id, :straw_volume_ton, :harvest_date, 'pending', NOW(), NOW())
    """)

    db.execute(sql_farmer, {
        "id": farmer_id,
        "full_name": payload.full_name,
        "phone_number": payload.phone_number,
        "national_id": payload.national_id,
        "village": payload.village,
        "district": payload.district,
        "province": payload.province
    })

    db.execute(sql_plot, {
        "id": plot_id,
        "farmer_id": farmer_id,
        "plot_name": payload.plot_name,
        "area_rai": payload.plot_area_acres,  # stored as area_rai in DB
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "district": payload.district,
        "province": payload.province
    })

    db.execute(sql_batch, {
        "id": batch_id,
        "batch_code": batch_code,
        "farmer_id": farmer_id,
        "plot_id": plot_id,
        "straw_volume_ton": payload.straw_volume_ton,
        "harvest_date": payload.harvest_date
    })
    
    # db.commit() is handled by the get_db dependency or test session
    
    return FarmerOnboardResponse(
        farmer_id=farmer_id,
        plot_id=plot_id,
        batch_id=batch_id,
        batch_code=batch_code,
        status="pending"
    )
