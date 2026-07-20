# Auth — verify Supabase Auth JWT (asymmetric, qua JWKS), phân quyền admin theo email whitelist

from functools import lru_cache

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import settings
from app.core.exceptions import AppError

# Tự động parse Authorization: Bearer <token>
bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    # JWKS client — cache để không fetch public key mỗi request
    return PyJWKClient(settings.SUPABASE_JWKS_URL)


def verify_supabase_token(token: str) -> dict:
    # Giải mã & verify Supabase Auth JWT bằng public key từ JWKS
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Token het han")
    except jwt.InvalidTokenError:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Token khong hop le")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    # Dependency — lấy payload user từ Bearer token Supabase
    if credentials is None:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Thieu Authorization header")
    return verify_supabase_token(credentials.credentials)


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    # Dependency — chỉ cho phép user có email nằm trong ADMIN_EMAILS
    if credentials is None:
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Thieu Authorization header")
    payload = verify_supabase_token(credentials.credentials)
    email = payload.get("email")
    if not email or email not in settings.ADMIN_EMAILS:
        raise AppError(403, code="FORBIDDEN", detail="Tai khoan khong co quyen admin")
    return payload
