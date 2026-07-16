# Tests cho main app: Qdrant startup, KB auth, isolation constraints

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


class TestKBAuth:
    def test_kb_seed_no_auth_returns_401(self, client: TestClient):
        r = client.post("/api/kb/seed")
        assert r.status_code == 401
        assert r.json()["code"] == "UNAUTHORIZED"

    def test_kb_seed_wrong_token_returns_401(self, client: TestClient):
        r = client.post("/api/kb/seed", headers={"Authorization": "Bearer wrong-key"})
        assert r.status_code == 401

    def test_kb_stats_no_auth_returns_401(self, client: TestClient):
        r = client.get("/api/kb/stats")
        assert r.status_code == 401

    def test_kb_stats_wrong_token_returns_401(self, client: TestClient):
        r = client.get("/api/kb/stats", headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 401


class TestIsolation:
    def test_chatbot_does_not_import_db_session(self):
        # Dam bao chatbot KHONG import SQLAlchemy Session hay model cua BE
        import sys
        for mod in list(sys.modules.keys()):
            if "sqlalchemy" in mod or "app.db" in mod or "psycopg2" in mod:
                raise AssertionError(f"Chatbot khong duoc import: {mod}")
        # Import thu app de verify
        try:
            from app.main import app  # noqa: F811
        except Exception as e:
            # Chi duoc phep loi Qdrant/network, khong duoc loi SQLAlchemy
            if "sqlalchemy" in str(e).lower() or "psycopg" in str(e).lower():
                raise AssertionError(f"Chatbot khong duoc phu thuoc DB: {e}")

    def test_chatbot_does_not_call_admin_api(self):
        # Kiem tra booking_api chi goi public endpoints
        # Bang cach verify cac method khong chua "admin"
        from app.integrations import booking_api as api
        import inspect
        for name, method in inspect.getmembers(api, inspect.iscoroutinefunction):
            src = inspect.getsource(method)
            if "admin" in src.lower():
                raise AssertionError(f"Method {name} goi admin API: {src}")


class TestHealth:
    def test_health_endpoint(self, client: TestClient):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_root_endpoint(self, client: TestClient):
        r = client.get("/")
        assert r.status_code == 200
        assert "Booking AI Chatbot" in r.json()["message"]
