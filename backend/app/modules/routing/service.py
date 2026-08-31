"""
app/modules/routing/service.py

Service layer for feedstock aggregation and geographic routing.
"""
import logging
import math
from typing import List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config.constants import CONSTANTS
from app.modules.routing.schemas import (
    CollectionZoneSchema,
    GeographicCoordinates,
    NearbyBatch,
    NearbyBatchGroup,
    PyrolysisFacilitySchema,
    RoutingAssignmentCreate,
    RoutingRecommendation,
    FlowVisualizationPlot,
    FlowVisualizationZone,
    FlowVisualizationFacility,
    FlowVisualizationData,
)

logger = logging.getLogger(__name__)

# Basic Earth radius in kilometers for Haversine
EARTH_RADIUS_KM = 6371.0

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c

def _get_batch_coordinates(batch_id: str, db: Session) -> Optional[dict]:
    sql = text("""
        SELECT
            sb.id::text as batch_id,
            sb.batch_code,
            sb.straw_volume_ton,
            pl.latitude,
            pl.longitude,
            pl.plot_name,
            f.full_name as farmer_name
        FROM straw_batches sb
        JOIN plot_locations pl ON sb.plot_id = pl.id
        JOIN farmers f ON sb.farmer_id = f.id
        WHERE sb.id = :batch_id
    """)
    row = db.execute(sql, {"batch_id": batch_id}).mappings().fetchone()
    return dict(row) if row else None

def find_nearby_batches(target_batch_id: str, db: Session) -> NearbyBatchGroup:
    """Finds all batches within CONSTANTS.GROUPING_RADIUS_KM of the target batch."""
    target = _get_batch_coordinates(target_batch_id, db)
    if not target:
        raise ValueError(f"Straw batch '{target_batch_id}' not found.")

    target_lat = float(target["latitude"])
    target_lon = float(target["longitude"])
    radius = CONSTANTS.GROUPING_RADIUS_KM

    # Using SQL Haversine for performance (though Python would work for small sets)
    sql = text("""
        SELECT
            sb.id::text as batch_id,
            sb.batch_code,
            sb.straw_volume_ton,
            pl.latitude,
            pl.longitude,
            pl.plot_name,
            f.full_name as farmer_name,
            (
                6371 * acos(LEAST(1, GREATEST(-1,
                    cos(radians(:target_lat)) * cos(radians(pl.latitude)) *
                    cos(radians(pl.longitude) - radians(:target_lon)) +
                    sin(radians(:target_lat)) * sin(radians(pl.latitude))
                )))
            ) AS distance_km
        FROM straw_batches sb
        JOIN plot_locations pl ON sb.plot_id = pl.id
        JOIN farmers f ON sb.farmer_id = f.id
        WHERE sb.status = 'registered' -- Only group pending batches
          AND sb.id != :target_id      -- Exclude target itself (we'll add it manually)
          AND NOT EXISTS (
              SELECT 1 FROM routing_assignments ra WHERE ra.batch_id = sb.id
          )
          AND (
            6371 * acos(LEAST(1, GREATEST(-1,
                cos(radians(:target_lat)) * cos(radians(pl.latitude)) *
                cos(radians(pl.longitude) - radians(:target_lon)) +
                sin(radians(:target_lat)) * sin(radians(pl.latitude))
            )))
          ) <= :radius
        ORDER BY distance_km ASC
    """)
    
    rows = db.execute(sql, {
        "target_lat": target_lat,
        "target_lon": target_lon,
        "target_id": target_batch_id,
        "radius": radius
    }).mappings().fetchall()

    # The target batch itself is always the center of its group (distance 0)
    target_batch = NearbyBatch(
        batch_id=target["batch_id"],
        batch_code=target["batch_code"],
        farmer_name=target["farmer_name"],
        plot_name=target["plot_name"],
        distance_km=0.0,
        straw_volume_ton=float(target["straw_volume_ton"]),
        latitude=target_lat,
        longitude=target_lon
    )

    nearby_batches = [target_batch]
    total_volume = float(target["straw_volume_ton"])
    
    sum_lat = target_lat
    sum_lon = target_lon

    for row in rows:
        lat = float(row["latitude"])
        lon = float(row["longitude"])
        vol = float(row["straw_volume_ton"])
        
        nearby_batches.append(NearbyBatch(
            batch_id=str(row["batch_id"]),
            batch_code=row["batch_code"],
            farmer_name=row["farmer_name"],
            plot_name=row["plot_name"],
            distance_km=float(row["distance_km"]),
            straw_volume_ton=vol,
            latitude=lat,
            longitude=lon
        ))
        total_volume += vol
        sum_lat += lat
        sum_lon += lon

    # Compute center of mass (centroid) for the group to find the best collection zone
    count = len(nearby_batches)
    centroid = GeographicCoordinates(
        latitude=sum_lat / count,
        longitude=sum_lon / count
    )

    return NearbyBatchGroup(
        target_batch_id=target_batch_id,
        target_coordinates=GeographicCoordinates(latitude=target_lat, longitude=target_lon),
        search_radius_km=radius,
        nearby_batches=nearby_batches,
        total_aggregated_volume_ton=total_volume,
        group_centroid=centroid
    )

def find_best_route(batch_id: str, db: Session) -> RoutingRecommendation:
    """
    Analyzes geography to recommend a route.
    1. Check if already assigned.
    2. Build feedstock aggregation group.
    3. Find nearest collection zone to the group's centroid.
    4. Link to pyrolysis facility.
    """
    # 1. Check existing assignment
    assigned_sql = text("""
        SELECT ra.assignment_status
        FROM routing_assignments ra
        WHERE ra.batch_id = :batch_id
    """)
    assigned_row = db.execute(assigned_sql, {"batch_id": batch_id}).mappings().fetchone()
    
    # 2. Build group
    group = find_nearby_batches(batch_id, db)
    
    # 3. Find nearest collection zone
    zone_sql = text("""
        SELECT
            id::text as zone_id,
            zone_code,
            zone_name,
            center_lat,
            center_lon,
            (
                6371 * acos(LEAST(1, GREATEST(-1,
                    cos(radians(:lat)) * cos(radians(center_lat)) *
                    cos(radians(center_lon) - radians(:lon)) +
                    sin(radians(:lat)) * sin(radians(center_lat))
                )))
            ) AS distance_km
        FROM collection_zones
        WHERE is_active = TRUE
        ORDER BY distance_km ASC
        LIMIT 1
    """)
    zone_row = db.execute(zone_sql, {
        "lat": group.group_centroid.latitude,
        "lon": group.group_centroid.longitude
    }).mappings().fetchone()

    recommended_zone = None
    associated_facility = None
    
    if zone_row:
        recommended_zone = CollectionZoneSchema(
            zone_id=str(zone_row["zone_id"]),
            zone_code=zone_row["zone_code"],
            zone_name=zone_row["zone_name"],
            distance_km=float(zone_row["distance_km"]),
            latitude=float(zone_row["center_lat"]),
            longitude=float(zone_row["center_lon"])
        )

        # 4. Find nearest pyrolysis facility to that collection zone
        fac_sql = text("""
            SELECT
                pf.id::text as facility_id,
                pf.facility_code,
                pf.facility_name,
                po.company_name as operator_name,
                pf.latitude,
                pf.longitude
            FROM pyrolysis_facilities pf
            JOIN pyrolysis_operators po ON pf.operator_id = po.id
            WHERE pf.is_active = TRUE
            ORDER BY (
                6371 * acos(LEAST(1, GREATEST(-1,
                    cos(radians(:lat)) * cos(radians(pf.latitude)) *
                    cos(radians(pf.longitude) - radians(:lon)) +
                    sin(radians(:lat)) * sin(radians(pf.latitude))
                )))
            ) ASC
            LIMIT 1
        """)
        fac_row = db.execute(fac_sql, {
            "lat": recommended_zone.latitude,
            "lon": recommended_zone.longitude
        }).mappings().fetchone()

        if fac_row:
            associated_facility = PyrolysisFacilitySchema(
                facility_id=str(fac_row["facility_id"]),
                facility_code=fac_row["facility_code"],
                facility_name=fac_row["facility_name"],
                operator_name=fac_row["operator_name"],
                latitude=float(fac_row["latitude"]),
                longitude=float(fac_row["longitude"])
            )

    return RoutingRecommendation(
        group=group,
        recommended_zone=recommended_zone,
        associated_facility=associated_facility,
        is_already_assigned=bool(assigned_row),
        assignment_status=assigned_row["assignment_status"] if assigned_row else None
    )

def create_assignments(assignment: RoutingAssignmentCreate, db: Session) -> int:
    """Create routing assignments for a group of batches."""
    sql = text("""
        INSERT INTO routing_assignments (
            batch_id,
            zone_id,
            facility_id,
            distance_km,
            scheduled_pickup,
            notes,
            assignment_status
        ) VALUES (
            :batch_id,
            :zone_id,
            :facility_id,
            :distance_km,
            :scheduled_pickup,
            :notes,
            'scheduled'
        )
        ON CONFLICT (batch_id) DO NOTHING
    """)
    
    count = 0
    for b_id in assignment.batch_ids:
        res = db.execute(sql, {
            "batch_id": b_id,
            "zone_id": assignment.zone_id,
            "facility_id": assignment.facility_id,
            "distance_km": assignment.distance_km,
            "scheduled_pickup": assignment.scheduled_pickup,
            "notes": assignment.notes
        })
        count += res.rowcount
    
    if count > 0:
        db.commit()
    return count

def get_feedstock_flow_visualization(db: Session) -> FlowVisualizationData:
    """Retrieve the entire geographic ecosystem for visualization."""
    # 1. Fetch facilities
    fac_sql = text("""
        SELECT id::text as facility_id, facility_code, facility_name, latitude, longitude
        FROM pyrolysis_facilities WHERE is_active = TRUE
    """)
    facilities_rows = db.execute(fac_sql).mappings().fetchall()
    
    # 2. Fetch collection zones
    zone_sql = text("""
        SELECT id::text as zone_id, zone_code, zone_name, center_lat as latitude, center_lon as longitude
        FROM collection_zones WHERE is_active = TRUE
    """)
    zones_rows = db.execute(zone_sql).mappings().fetchall()
    
    # 3. Fetch routed batches
    batch_sql = text("""
        SELECT 
            ra.facility_id::text as facility_id,
            ra.collection_zone_id::text as zone_id,
            sb.id::text as batch_id,
            sb.batch_code,
            sb.straw_volume_ton,
            f.full_name as farmer_name,
            pl.latitude,
            pl.longitude
        FROM routing_assignments ra
        JOIN straw_batches sb ON ra.batch_id = sb.id
        JOIN plot_locations pl ON sb.plot_id = pl.id
        JOIN farmers f ON sb.farmer_id = f.id
    """)
    routed_batches = db.execute(batch_sql).mappings().fetchall()
    
    # Organize data hierarchically
    zones_by_id = {}
    for z in zones_rows:
        zones_by_id[str(z["zone_id"])] = FlowVisualizationZone(
            zone_id=str(z["zone_id"]),
            zone_code=z["zone_code"],
            zone_name=z["zone_name"],
            latitude=float(z["latitude"]),
            longitude=float(z["longitude"]),
            total_assigned_volume_ton=0.0,
            assigned_plots=[]
        )
        
    facs_by_id = {}
    for f in facilities_rows:
        facs_by_id[str(f["facility_id"])] = FlowVisualizationFacility(
            facility_id=str(f["facility_id"]),
            facility_code=f["facility_code"],
            facility_name=f["facility_name"],
            latitude=float(f["latitude"]),
            longitude=float(f["longitude"]),
            total_feedstock_volume_ton=0.0,
            collection_zones=[]
        )

    total_ecosystem_vol = 0.0
    total_plots = 0
    
    # Map batches to zones
    for b in routed_batches:
        z_id = str(b["zone_id"])
        f_id = str(b["facility_id"])
        vol = float(b["straw_volume_ton"])
        
        plot = FlowVisualizationPlot(
            batch_id=str(b["batch_id"]),
            batch_code=b["batch_code"],
            farmer_name=b["farmer_name"],
            straw_volume_ton=vol,
            latitude=float(b["latitude"]),
            longitude=float(b["longitude"])
        )
        
        if z_id in zones_by_id:
            zones_by_id[z_id].assigned_plots.append(plot)
            zones_by_id[z_id].total_assigned_volume_ton += vol
            
        if f_id in facs_by_id:
            facs_by_id[f_id].total_feedstock_volume_ton += vol
            
        total_ecosystem_vol += vol
        total_plots += 1
        
    # Map zones to facilities
    # Note: Currently routing_assignments maps batch->zone->facility. 
    # A zone could theoretically be mapped to multiple facilities if different batches in the zone go to different places.
    # We will map zones to facilities based on the routed batches.
    zone_to_fac = {}
    for b in routed_batches:
        zone_to_fac[str(b["zone_id"])] = str(b["facility_id"])
        
    for z_id, fac_id in zone_to_fac.items():
        if z_id in zones_by_id and fac_id in facs_by_id:
            facs_by_id[fac_id].collection_zones.append(zones_by_id[z_id])
            
    # Include empty zones in the closest facility? For now, we only show connected ones or just add empty zones to a generic list.
    # The requirement is to show the physical feedstock flow based on stored routing assignments.
    
    facilities_list = list(facs_by_id.values())
    
    return FlowVisualizationData(
        facilities=facilities_list,
        total_facilities=len(facilities_list),
        total_zones=len(zones_by_id),
        total_plots=total_plots,
        total_ecosystem_volume_ton=total_ecosystem_vol
    )
