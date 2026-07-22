from app.main import app


# Xác nhận timeline dùng resource schedule rõ nghĩa và không còn endpoint booking số ít gây nhầm lẫn.
def test_admin_schedule_route_replaces_singular_booking_route():
    paths = set(app.openapi()["paths"])

    assert "/api/admin/schedule" in paths
    assert "/api/admin/booking" not in paths
    assert "/api/admin/bookings" in paths
    assert "/api/admin/bookings/{booking_id}" in paths


# Xác nhận mọi endpoint thành công đều công bố response schema cụ thể cho Swagger.
def test_every_openapi_operation_has_non_empty_success_schema():
    schema = app.openapi()
    violations = []
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            if method not in {"get", "post", "patch", "delete"}:
                continue
            success = operation["responses"].get("200") or operation["responses"].get("201")
            response_schema = (
                (success or {})
                .get("content", {})
                .get("application/json", {})
                .get("schema")
            )
            if not response_schema:
                violations.append(f"{method.upper()} {path}")

    assert violations == []
