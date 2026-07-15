# Auth / JWT — tạo token, verify token, dependency lấy admin hiện tại

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.exceptions import AppError

# Dùng HTTPBearer để tự động parse Authorization header
# Swagger UI sẽ hiển thị nút Authorize
bearer_scheme = HTTPBearer(auto_error=False)


def _hash_password(password: str, salt: str | None = None) -> str:
    # Băm mật khẩu SHA-256 + salt ngẫu nhiên
    if salt is None:
        salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${h}"


def _verify_password(password: str, hashed: str) -> bool:
    # Kiểm tra mật khẩu với hash đã lưu
    try:
        salt, h = hashed.split("$", 1)
        return _hash_password(password, salt) == hashed
    except ValueError:
        return False


# Admin credentials (có thể mở rộng sau bằng DB hoặc env list)
_ADMIN_STORED_HASH = _hash_password(settings.ADMIN_PASSWORD)


def verify_admin_password(password: str) -> bool:
    # Kiểm tra password admin
    return _verify_password(password, _ADMIN_STORED_HASH)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    # Tạo JWT token — payload chứa data + exp + iat
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now, "sub": data.get("sub", "admin")})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict[str, Any]:
    # Giải mã & verify JWT token — raise AppError nếu hết hạn hoặc không hợp lệ
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Token het han")
    except jwt.InvalidTokenError:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Token khong hop le")


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    # Dependency — lấy admin từ Bearer token. Dùng cho admin routers
    if credentials is None:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Thieu Authorization header")
    payload = verify_token(credentials.credentials)
    return payload
