# Booking AI Chatbot

FastAPI service cung cấp chatbot tư vấn, tra cứu thông tin và hỗ trợ quy trình booking bằng RAG và Booking Backend API.

## Chức năng

- Hỏi đáp FAQ và policy bằng Qdrant
- Semantic search với sentence-transformers
- Intent routing giữa FAQ và booking operations
- Tra cứu shop, course và available slot theo thời gian thực
- Kiểm tra booking eligibility
- Hỗ trợ tạo, đổi lịch và hủy booking
- Yêu cầu xác nhận trước các mutation
- Không truy cập trực tiếp database booking

## Kiến trúc

```text
User
  → Intent Router
      ├── FAQ → Qdrant → Groq
      └── Booking Tool → Booking Backend API
```

## Công nghệ

- FastAPI
- Qdrant
- Groq (OpenAI-compatible SDK)
- sentence-transformers
- httpx

## Cài đặt

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
```

## Biến môi trường

```env
GROQ_API_KEY=gsk-...
GROQ_MODEL=mixtral-8x7b-32768
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=kb_chunks
BOOKING_API_URL=http://localhost:8000
BOOKING_API_SERVICE_KEY=...
ADMIN_API_KEY=change-me-in-production
```

## Yêu cầu

- Qdrant đang chạy (docker run -p 6333:6333 qdrant/qdrant)
- Booking Backend đang chạy ở port 8000
```
