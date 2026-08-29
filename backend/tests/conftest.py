import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Do not override the database URL, we want to use the real DB
# but we will rely on transactional rollbacks for isolation.
os.environ["APP_ENV"] = "testing"

from app.main import app
from app.database.connection import Base, get_db

from app.config.settings import get_settings

# Use the real database URL from environment or settings
settings = get_settings()
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """No schema creation needed, using the real DB schema."""
    yield

@pytest.fixture
def db_session():
    """Provide a transactional scope around a series of operations."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    """Provide a TestClient that uses the test database."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
