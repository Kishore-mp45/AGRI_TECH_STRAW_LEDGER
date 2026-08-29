def test_get_dashboard(client):
    """Test the operator dashboard API returns successful response."""
    response = client.get("/api/v1/operators/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "feedstock" in data["data"]
    assert "carbon" in data["data"]
    assert "economics" in data["data"]

def test_get_routing_flow(client):
    """Test the routing flow visualization API."""
    response = client.get("/api/v1/routing/flow-visualization")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "facilities" in data["data"]

def test_missing_required_fields_onboard(client):
    """Test that missing required fields return a 422 validation error."""
    # Missing 'full_name' and 'plot_name'
    response = client.post("/api/v1/farmers/onboard", json={
        "phone_number": "123456789",
        "village": "Test Village",
        "province": "Test Province",
        "plot_area_acres": 10.0,
        "latitude": 18.0,
        "longitude": 98.0,
        "straw_volume_ton": 50.0,
        "harvest_date": "2026-01-01"
    })
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert any("full_name" in err["field"] for err in data["errors"])
    assert any("plot_name" in err["field"] for err in data["errors"])

def test_successful_onboard(client):
    """Test successful farmer onboarding via API."""
    response = client.post("/api/v1/farmers/onboard", json={
        "full_name": "Test Farmer",
        "phone_number": "123456789",
        "village": "Test Village",
        "district": "Test District",
        "province": "Test Province",
        "plot_name": "Test Plot",
        "plot_area_acres": 10.0,
        "latitude": 18.0,
        "longitude": 98.0,
        "straw_volume_ton": 50.0,
        "harvest_date": "2026-01-01"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "farmer_id" in data["data"]
    assert "batch_code" in data["data"]
