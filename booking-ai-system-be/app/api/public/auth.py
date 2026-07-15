# Public — Login admin, lấy JWT token

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.auth import create_access_token, verify_admin_password
from app.core.config import settings
from app.core.exceptions import AppError

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginInput(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


@router.post("/login")
def login(body: LoginInput):
    # Kiểm tra username & password
    if body.username != settings.ADMIN_USERNAME or not verify_admin_password(body.password):
        raise AppError(401, code="AUTHENTICATION_REQUIRED", detail="Sai username hoac password")

    token = create_access_token({"sub": body.username, "username": body.username})
    return {
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
        }
    }
