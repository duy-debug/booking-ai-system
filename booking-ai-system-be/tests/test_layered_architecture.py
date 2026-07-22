import ast
from pathlib import Path


API_ROOT = Path("app/api")
SERVICE_ROOT = Path("app/services")


# Đọc toàn bộ module Python dưới một thư mục để các quy tắc kiến trúc được kiểm tra tự động.
def _python_modules(root: Path):
    for path in root.rglob("*.py"):
        yield path, ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


# Bảo đảm router chỉ phụ thuộc service/schema và không truy cập repository hoặc ORM model.
def test_api_layer_does_not_import_repository_or_database_models():
    violations = []
    for path, tree in _python_modules(API_ROOT):
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                if node.module.startswith(("app.repositories", "app.db.models")):
                    violations.append(f"{path}:{node.lineno}:{node.module}")

    assert violations == []


# Bảo đảm mọi operation API khai báo response_model để Swagger có contract response cụ thể.
def test_every_api_operation_declares_response_model():
    violations = []
    for path, tree in _python_modules(API_ROOT):
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call) or not isinstance(
                    decorator.func, ast.Attribute
                ):
                    continue
                if decorator.func.attr not in {"get", "post", "patch", "delete"}:
                    continue
                if not any(keyword.arg == "response_model" for keyword in decorator.keywords):
                    violations.append(f"{path}:{node.lineno}:{node.name}")

    assert violations == []


# Bảo đảm service không nhận phụ thuộc HTTP của FastAPI và chỉ dùng session cho transaction boundary.
def test_service_layer_has_no_http_dependency_or_direct_database_operation():
    violations = []
    forbidden_session_methods = {
        "add",
        "delete",
        "execute",
        "scalar",
        "scalars",
        "get",
        "query",
        "flush",
        "refresh",
    }
    for path, tree in _python_modules(SERVICE_ROOT):
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "fastapi":
                violations.append(f"{path}:{node.lineno}:fastapi")
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            owner = node.func.value
            if (
                isinstance(owner, ast.Attribute)
                and isinstance(owner.value, ast.Name)
                and owner.value.id == "self"
                and owner.attr == "session"
                and node.func.attr in forbidden_session_methods
            ):
                violations.append(f"{path}:{node.lineno}:session.{node.func.attr}")

    assert violations == []


# Xác nhận query, command và schedule đã được tách thành ba service có trách nhiệm rõ ràng.
def test_booking_services_are_separated():
    booking_source = Path("app/services/booking_service.py").read_text(encoding="utf-8")

    assert "class BookingService" in booking_source
    assert "def get_schedule" not in booking_source
    assert Path("app/services/booking_query_service.py").exists()
    assert Path("app/services/schedule_service.py").exists()
