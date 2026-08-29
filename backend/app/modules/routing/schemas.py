"""
app/modules/routing/schemas.py

Pydantic schemas for the Routing & Feedstock Aggregation module.
"""
from typing import List, Optional
from pydantic import BaseModel

from app.schemas.common import BaseSchema

class GeographicCoordinates(BaseSchema):
    latitude: float
    longitude: float

class NearbyBatch(BaseSchema):
    batch_id: str
    batch_code: str
    farmer_name: str
    plot_name: str
    distance_km: float
    straw_volume_ton: float
    latitude: float
    longitude: float

class NearbyBatchGroup(BaseSchema):
    target_batch_id: str
    target_coordinates: GeographicCoordinates
    search_radius_km: float
    nearby_batches: List[NearbyBatch]
    total_aggregated_volume_ton: float
    group_centroid: GeographicCoordinates

class CollectionZoneSchema(BaseSchema):
    zone_id: str
    zone_code: str
    zone_name: str
    distance_km: float
    latitude: float
    longitude: float

class PyrolysisFacilitySchema(BaseSchema):
    facility_id: str
    facility_code: str
    facility_name: str
    operator_name: str
    latitude: float
    longitude: float

class RoutingRecommendation(BaseSchema):
    group: NearbyBatchGroup
    recommended_zone: Optional[CollectionZoneSchema]
    associated_facility: Optional[PyrolysisFacilitySchema]
    is_already_assigned: bool
    assignment_status: Optional[str]

class RoutingAssignmentCreate(BaseSchema):
    batch_ids: List[str]
    zone_id: str
    facility_id: str
    distance_km: float
    scheduled_pickup: Optional[str] = None
    notes: Optional[str] = None

class FlowVisualizationPlot(BaseSchema):
    batch_id: str
    batch_code: str
    farmer_name: str
    straw_volume_ton: float
    latitude: float
    longitude: float

class FlowVisualizationZone(BaseSchema):
    zone_id: str
    zone_code: str
    zone_name: str
    latitude: float
    longitude: float
    total_assigned_volume_ton: float
    assigned_plots: List[FlowVisualizationPlot]

class FlowVisualizationFacility(BaseSchema):
    facility_id: str
    facility_code: str
    facility_name: str
    latitude: float
    longitude: float
    total_feedstock_volume_ton: float
    collection_zones: List[FlowVisualizationZone]

class FlowVisualizationData(BaseSchema):
    facilities: List[FlowVisualizationFacility]
    total_facilities: int
    total_zones: int
    total_plots: int
    total_ecosystem_volume_ton: float
