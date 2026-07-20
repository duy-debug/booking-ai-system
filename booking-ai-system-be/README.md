# Booking AI System — Backend

FastAPI service chịu trách nhiệm quản lý dữ liệu và business rules của hệ thống đặt lịch massage.

## Chức năng

- Quản lý shop, course, therapist và therapist shift
- Quản lý customer restriction và NG list
- Tính toán available slot và kiểm tra booking eligibility
- Tạo, tra cứu, cập nhật và hủy booking
- JWT authentication cho Admin API
- Error response theo chuẩn RFC 9457 (Problem Details)
- Database migration bằng Alembic

## Kiến trúc (layered)

```
app/
├── main.py            # FastAPI entrypoint — routers, CORS, exception handlers (RFC 9457)
├── api/
│   ├── admin/        # Các endpoint quản trị (bảo vệ bởi JWT)
│   │   ├── shops.py
│   │   ├── courses.py
│   │   ├── therapists.py
│   │   ├── therapist_shifts.py
│   │   ├── customer_restrictions.py
│   │   └── bookings.py        # Read-only admin booking views
│   ├── public/       # Các endpoint công khai (không cần JWT, trừ auth)
│   │   ├── shops.py
│   │   ├── available_slots.py
│   │   ├── booking_eligibility.py
│   │   ├── bookings.py
│   │   ├── therapist_schedule.py
│   │   └── auth.py           # Đăng nhập admin → JWT
│   └── deps.py            # get_db(), parse_uuid()
├── services/          # Business logic — SỞ HỮU transaction (commit/rollback/refresh)
├── repositories/      # Data-access mỏng — chỉ query/write, KHÔNG commit
├── schemas/           # Pydantic request/response models
├── db/               # SQLAlchemy models, session, base
│   └── models/
├── core/             # config, auth (JWT), exceptions, supabase client
└── scripts/          # Seed dữ liệu mẫu
```

### Nguyên tắc phân lớp

1. **Routers (api/)** — mỏng: chỉ parse request, gọi Service, trả response.
   Không thao tác DB trực tiếp (không `session.add` / `commit` / `refresh`).
2. **Services (services/)** — sở hữu transaction: `try → repo.save → session.commit()
   → session.refresh() → except → session.rollback() → raise`.
   Chứa toàn bộ business validation (mã duy nhất, overlap ca làm việc, NG list…).
3. **Repositories (repositories/)** — chỉ truy vấn và `session.add`/`flush`;
   không `commit`/`rollback`.
4. **Admin vs Public** — endpoint `/api/admin/*` yêu cầu Supabase Auth JWT; `/api/*` công khai.

### Xác thực (Supabase Auth — asymmetric / JWKS)

- Backend **không tự viết login**. Frontend đăng nhập qua Supabase Auth, gửi access token
  vào header `Authorization: Bearer <supabase_jwt>`.
- Backend verify token bằng **public key từ JWKS** (`SUPABASE_JWKS_URL`), thuật toán `ES256`
  (ECC P-256 — Supabase mặc định). Không dùng shared secret.
- Quyền admin: email trong token phải nằm trong `ADMIN_EMAILS` (whitelist env),
  nếu không trả `403 FORBIDDEN`.
- Public endpoints (`/api/shops`, `/api/bookings`, slots, eligibility…) không cần token.

#### Cách lấy `SUPABASE_JWKS_URL`

JWKS URL có dạng cố định, chỉ thay `<project-ref>` bằng ref của project:

```
https://<project-ref>.supabase.co/auth/v1/keys
```

- `<project-ref>` nằm trong URL Supabase của bạn, ví dụ `https://hjwygekteyhdfjnjqvrdl.supabase.co`
  → project-ref là `hjwygekteyhdfjnjqvrdl`.
- Cách tìm project-ref: Supabase Dashboard → chọn project → **Project Settings → General**
  (phần **Reference ID**), hoặc lấy từ đoạn đầu URL project.
- Có thể mở thử trên trình duyệt để xác nhận: trả về một JSON chứa mảng `keys` (public key).
- Truy cập Supabase JWT Keys (Settings → API/JWT Keys) để xem thuật toán đang dùng
  (mặc định **ECC P-256 / ES256**). Nếu project dùng asymmetric, backend verify qua JWKS là đúng.

> **RAG đã được tách hoàn toàn khỏi backend.** Vector search (Qdrant + Groq) giờ nằm
> trong service độc lập `booking-ai-chatbot/`. Backend không còn thư mục `app/rag/`
> hay `app/modules/`, và bảng `kb_chunks` (cùng model `KnowledgeChunk`) đã được xoá
> qua migration `a3f7c9d2e1b0_remove_kb_chunks_table`. Backend chỉ còn tầng dữ liệu
> giao dịch (PostgreSQL).

## Công nghệ

- FastAPI
- Pydantic
- SQLAlchemy 2.0
- Alembic
- Supabase PostgreSQL
- PyJWT + JWKS (verify Supabase Auth ES256 token)
- Pytest

## Cài đặt

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
```

## Chạy

```powershell
# Migration
alembic upgrade head

# Dev server
uvicorn app.main:app --reload --port 8000
```

## Kiểm thử

```powershell
pytest            # toàn bộ test suite
pytest -v        # chi tiết từng test
```

Bao gồm 174 test across 6 modules:

| Module | Nội dung |
|---|---|
| `test_services.py` | Logic service layer (booking, slot, eligibility, schedule, admin) |
| `test_admin_services.py` | CRUD admin services + conflict/overlap |
| `test_repositories.py` | Truy vấn repository |
| `test_booking_flow.py` | Luồng tạo / huỷ / cập nhật booking |
| `test_admin_flow.py` | Luồng API admin end-to-end |
| `test_contract_public_fields.py` | Hợp đồng trường response public |
