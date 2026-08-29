from typing import Optional
from app.schemas.common import BaseSchema

class FarmerOnboardRequest(BaseSchema):
    full_name: str
    phone_number: str
    national_id: Optional[str] = None
    village: str
    district: str
    province: str
    
    plot_name: str
    plot_area_acres: float
    latitude: float
    longitude: float
    
    straw_volume_ton: float
    crop_type: str = "rice"
    harvest_date: str

class FarmerOnboardResponse(BaseSchema):
    farmer_id: str
    plot_id: str
    batch_id: str
    batch_code: str
    status: str
