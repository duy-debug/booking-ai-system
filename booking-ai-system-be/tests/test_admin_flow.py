# Integration test — Admin CRUD flow: Shop → Course → Therapist → Shift

from fastapi.testclient import TestClient


class TestAdminShop:
    """Flow 1: CRUD shop — list, get, update"""

    def test_create_shop_persisted(self, test_data: dict):
        # Shop đã được tạo trong fixture test_data
        assert test_data["shop_id"] is not None

    def test_list_shops(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get("/api/admin/shops", headers=auth_headers)
        assert r.status_code == 200
        ids = [s["shop_id"] for s in r.json()["data"]]
        assert test_data["shop_id"] in ids

    def test_get_shop(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(f"/api/admin/shops/{test_data['shop_id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_update_shop(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.patch(
            f"/api/admin/shops/{test_data['shop_id']}",
            json={"name": "Test Shop Updated"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Test Shop Updated"


class TestAdminCourse:
    """Flow 2: CRUD course"""

    def test_create_course_persisted(self, test_data: dict):
        assert test_data["course_id"] is not None

    def test_list_courses(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(
            f"/api/admin/shops/{test_data['shop_id']}/courses",
            headers=auth_headers,
        )
        assert r.status_code == 200
        ids = [c["course_id"] for c in r.json()["data"]]
        assert test_data["course_id"] in ids

    def test_get_course(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(f"/api/admin/courses/{test_data['course_id']}", headers=auth_headers)
        assert r.status_code == 200

    def test_update_course(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.patch(
            f"/api/admin/courses/{test_data['course_id']}",
            json={"price": 6000.00},
            headers=auth_headers,
        )
        assert r.status_code == 200
        # Decimal trả về string trong JSON
        assert str(r.json()["data"]["price"]) == "6000.00"


class TestAdminTherapist:
    """Flow 3: CRUD therapist"""

    def test_create_therapist_persisted(self, test_data: dict):
        assert test_data["therapist_id"] is not None

    def test_list_therapists(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(
            f"/api/admin/shops/{test_data['shop_id']}/therapists",
            headers=auth_headers,
        )
        assert r.status_code == 200
        ids = [t["therapist_id"] for t in r.json()["data"]]
        assert test_data["therapist_id"] in ids

    def test_get_therapist(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(
            f"/api/admin/therapists/{test_data['therapist_id']}",
            headers=auth_headers,
        )
        assert r.status_code == 200

    def test_update_therapist(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.patch(
            f"/api/admin/therapists/{test_data['therapist_id']}",
            json={"name": "Test Therapist Updated"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Test Therapist Updated"


class TestAdminShift:
    """Flow 4: CRUD shift"""

    def test_create_shift_persisted(self, test_data: dict):
        assert test_data["shift_id"] is not None

    def test_list_shifts(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(
            f"/api/admin/shops/{test_data['shop_id']}/therapist-shifts",
            headers=auth_headers,
        )
        assert r.status_code == 200
        ids = [s["shift_id"] for s in r.json()["data"]]
        assert test_data["shift_id"] in ids

    def test_get_shift(self, client: TestClient, auth_headers: dict, test_data: dict):
        r = client.get(
            f"/api/admin/therapist-shifts/{test_data['shift_id']}",
            headers=auth_headers,
        )
        assert r.status_code == 200

    def test_update_shift(self, client: TestClient, auth_headers: dict, test_data: dict):
        # Chỉ update start_time — không tắt is_active để booking flow vẫn dùng được
        r = client.patch(
            f"/api/admin/therapist-shifts/{test_data['shift_id']}",
            json={"start_time": "08:00"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["data"]["start_time"] == "08:00:00"
