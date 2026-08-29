from app.modules.routing.service import haversine

def test_haversine_distance():
    """Verify geographic distance calculations are accurate."""
    # Coordinates for roughly 1 degree of latitude (~111 km)
    lat1, lon1 = 18.0, 98.0
    lat2, lon2 = 19.0, 98.0
    dist = haversine(lat1, lon1, lat2, lon2)
    assert 110 < dist < 112

def test_haversine_same_point():
    """Distance between same point should be 0."""
    dist = haversine(18.5, 98.5, 18.5, 98.5)
    assert dist == 0.0
