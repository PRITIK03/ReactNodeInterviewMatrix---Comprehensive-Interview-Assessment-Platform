from fastapi.testclient import TestClient
from backend.store import initialize
from backend.main import app
import os
import uuid
import pytest
import psycopg
from psycopg import sql


@pytest.fixture(autouse=True)
def isolate_test_database(monkeypatch):
    # Never run the suite against an application's configured database.
    monkeypatch.delenv("DATABASE_URL", raising=False)
    dsn = os.getenv("MATRIX_TEST_POSTGRES")
    if not dsn:
        yield
        return
    schema = "matrix_test_" + uuid.uuid4().hex
    with psycopg.connect(dsn, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
        monkeypatch.setenv("PGOPTIONS", "-c search_path=" + schema)
        monkeypatch.setenv("DATABASE_URL", dsn)
        try:
            yield
        finally:
            admin.execute(
                sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema))
            )


@pytest.fixture
def site(tmp_path, monkeypatch):
    monkeypatch.setenv("MATRIX_DB", str(tmp_path / "test.sqlite3"))
    initialize()

    def login(name, role):
        client = TestClient(app, base_url="http://localhost")
        credentials = {
            "email": name + "@example.org",
            "password": "fictional-passphrase",
        }
        assert (
            client.post(
                "/api/v1/register",
                json={**credentials, "role": role, "organization": "Test organization"},
            ).status_code
            == 201
        )
        assert client.post("/api/v1/login", json=credentials).status_code == 200
        return client

    return login
