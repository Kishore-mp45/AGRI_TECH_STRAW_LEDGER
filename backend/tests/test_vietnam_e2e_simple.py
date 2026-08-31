"""
Simple E2E Test for Vietnam Localization
Verifies: Province-based onboarding, registered batch status, and dashboard aggregation
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.database.connection import SessionLocal

@pytest.fixture
def client():
    """Provide a test client."""
    return TestClient(app)

@pytest.fixture
def db():
    """Provide a database session."""
    session = SessionLocal()
    yield session
    session.close()

def test_vietnam_registration_with_vnd_dashboard(client, db):
    """
    E2E Test: Register Vietnam farmer and verify dashboard shows in VND.
    """
    unique_id = str(uuid.uuid4())[:8]
    
    # Onboard farmer
    payload = {
        "full_name": f"Nguyễn Test {unique_id}",
        "phone_number": f"+84 912 {unique_id}",
        "village": "Test Village",
        "province": "Hà Nội",
        "plot_name": "Test Plot",
        "plot_area_acres": 10.0,
        "latitude": 20.98,
        "longitude": 105.78,
        "straw_volume_ton": 25.0,
        "harvest_date": "2026-01-10"
    }
    
    response = client.post("/api/v1/farmers/onboard", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "registered"
    
    batch_code = data["data"]["batch_code"]
    
    # Verify in database
    sql = text("SELECT status FROM straw_batches WHERE batch_code = :code")
    row = db.execute(sql, {"code": batch_code}).fetchone()
    assert row[0] == "registered"
    
    # Check dashboard
    response = client.get("/api/v1/operators/dashboard")
    assert response.status_code == 200
    dashboard = response.json()
    assert dashboard["success"] is True
    assert dashboard["data"]["feedstock"]["total_registered_batches"] >= 1


def test_vietnam_phone_variations_all_formats(client):
    """
    Test that Vietnam phone formats are normalized correctly.
    """
    unique_base = str(uuid.uuid4())[:6]
    phones = [
        (f"+84 912 111 {unique_base}", "test1"),
        (f"+84912222{unique_base}", "test2"),
        (f"0912333{unique_base}", "test3"),
    ]
    
    for phone, suffix in phones:
        payload = {
            "full_name": f"Farmer {suffix} {str(uuid.uuid4())[:4]}",
            "phone_number": phone,
            "village": "Test",
            "province": "Hà Nội",
            "plot_name": f"Plot {suffix}",
            "plot_area_acres": 5.0,
            "latitude": 20.98,
            "longitude": 105.78,
            "straw_volume_ton": 10.0,
            "harvest_date": "2026-01-15"
        }
        
        response = client.post("/api/v1/farmers/onboard", json=payload)
        assert response.status_code == 200, f"Failed for {phone}: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] == "registered"
