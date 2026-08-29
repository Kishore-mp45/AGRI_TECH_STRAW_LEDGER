import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

def test_database_connection(db_session):
    """Test that we can connect to the database and run a simple query."""
    result = db_session.execute(text("SELECT 1 AS ping")).fetchone()
    assert result[0] == 1

def test_foreign_key_constraint(db_session):
    """Verify that inserting a batch with a non-existent farmer UUID fails with an IntegrityError."""
    sql = text("""
        INSERT INTO straw_batches (id, batch_code, farmer_id, plot_id, straw_volume_ton, harvest_date, status, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000000', 'TEST-FK-1', '99999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', 10, '2026-01-01', 'pending', NOW(), NOW())
    """)
    # Should raise IntegrityError (foreign key violation)
    with pytest.raises(IntegrityError):
        db_session.execute(sql)
        db_session.flush()

def test_not_null_constraint(db_session):
    """Verify that missing a required NOT NULL field (batch_code) raises IntegrityError."""
    sql = text("""
        INSERT INTO straw_batches (id, farmer_id, plot_id, straw_volume_ton, harvest_date, status, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 10, '2026-01-01', 'pending', NOW(), NOW())
    """)
    with pytest.raises(IntegrityError):
        db_session.execute(sql)
        db_session.flush()

def test_check_constraint_invalid_status(db_session):
    """Verify the status check constraint rejects unknown status values."""
    sql = text("""
        INSERT INTO straw_batches (id, batch_code, farmer_id, plot_id, straw_volume_ton, harvest_date, status, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000002', 'TEST-CHK-1', '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 10, '2026-01-01', 'invalid_status', NOW(), NOW())
    """)
    with pytest.raises(Exception):  # CheckViolation or IntegrityError
        db_session.execute(sql)
        db_session.flush()

def test_valid_tables_exist(db_session):
    """Verify all expected tables exist in the database."""
    tables = [
        "farmers", "plot_locations", "straw_batches",
        "collection_zones", "pyrolysis_facilities",
        "routing_assignments", "calculation_results", "mrv_records"
    ]
    for table in tables:
        result = db_session.execute(
            text("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = :t"),
            {"t": table}
        ).scalar()
        assert result == 1, f"Table '{table}' does not exist in the database"
