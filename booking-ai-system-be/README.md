# Booking AI System Backend

FastAPI service chịu trách nhiệm quản lý dữ liệu và business rules của hệ thống đặt lịch massage.

## Chức năng

- Quản lý shop, course, therapist và therapist shift
- Quản lý customer restriction và NG list
- Kiểm tra available slot và booking eligibility
- Tạo, tra cứu, cập nhật và hủy booking
- JWT authentication cho Admin API
- Error response theo RFC 9457
- Database migration bằng Alembic

## Công nghệ

- FastAPI
- Pydantic
- SQLAlchemy 2.0
- Alembic
- Supabase PostgreSQL
- Pytest

## Cài đặt

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
```
