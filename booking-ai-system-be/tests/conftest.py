# Fixtures chung cho integration tests — app client + auth headers + test data

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

# Tiền tố duy nhất cho toàn bộ test session — dễ nhận diện và cleanup
TAG = f"test-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient — dùng chung cho cả session"""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client: TestClient) -> str:
    """Login admin → trả về JWT token"""
    r = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, f"Login fail: {r.text}"
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token: str) -> dict[str, str]:
    """Header Authorization Bearer cho admin requests"""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(scope="session")
def test_data(client: TestClient, auth_headers: dict) -> dict:
    """Tạo toàn bộ test data — shop → course → therapist → shift → cleanup sau session"""
    data: dict = {}
    data["phone"] = f"0999{TAG[-8:]}"
    data["idem_key"] = str(uuid.uuid4())

    # Tạo shop
    r = client.post(
        "/api/admin/shops",
        json={
            "shop_code": f"{TAG}-shop",
            "pos_shop_code": f"{TAG}-pos-shop",
            "name": "Test Shop",
            "address": "123 Test St",
            "phone": "0900000000",
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, f"Create shop fail: {r.text}"
    data["shop_id"] = r.json()["data"]["shop_id"]

    # Tạo main course
    r = client.post(
        f"/api/admin/shops/{data['shop_id']}/courses",
        json={
            "pos_course_code": f"{TAG}-course",
            "name": "Test Massage 60min",
            "duration_minutes": 60,
            "price": 5000.00,
            "course_type": "main",
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, f"Create course fail: {r.text}"
    data["course_id"] = r.json()["data"]["course_id"]

    # Tạo therapist
    r = client.post(
        f"/api/admin/shops/{data['shop_id']}/therapists",
        json={
            "pos_therapist_code": f"{TAG}-therapist",
            "name": "Test Therapist",
            "gender": "female",
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, f"Create therapist fail: {r.text}"
    data["therapist_id"] = r.json()["data"]["therapist_id"]

    # Tạo shift
    r = client.post(
        "/api/admin/therapist-shifts",
        json={
            "shop_id": data["shop_id"],
            "therapist_id": data["therapist_id"],
            "work_date": "2026-07-20",
            "start_time": "09:00",
            "end_time": "18:00",
            "is_active": True,
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, f"Create shift fail: {r.text}"
    data["shift_id"] = r.json()["data"]["shift_id"]

    yield data

    # Cleanup — xóa toàn bộ dữ liệu test đã tạo
    for eid in [data.get("shift_id"), data.get("course_id"), data.get("therapist_id"), data.get("shop_id")]:
        if eid:
            # Xóa shift → course/therapist → shop (duy trì FK constraint)
            for prefix, entity in [
                ("/api/admin/therapist-shifts", data.get("shift_id")),
                (f"/api/admin/shops/{data.get('shop_id')}/courses", data.get("course_id")),
                (f"/api/admin/shops/{data.get('shop_id')}/therapists", data.get("therapist_id")),
                ("/api/admin/shops", data.get("shop_id")),
            ]:
                if entity:
                    pass  # API không có DELETE — dùng PATCH set is_active=false
