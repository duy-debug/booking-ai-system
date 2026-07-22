from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, parse_uuid
from app.core.auth import require_admin
from app.core.exceptions import AppError
from app.schemas.booking import (
    AdminBookingDetailResponse,
    AdminBookingListResponse,
    BookingPatchInput,
    PublicBookingResponse,
)
from app.schemas.common import DataResponse, PaginatedResponse
from app.services.booking_query_service import BookingQueryService
from app.services.booking_service import BookingService

router = APIRouter(prefix="/api/admin/bookings", tags=["admin-bookings"], dependencies=[Depends(require_admin)])


# Danh sách booking (admin) — lọc theo shop, ngày, trạng thái, số điện thoại, mã POS
@router.get("", response_model=PaginatedResponse[AdminBookingListResponse])
def list_admin_bookings(
    shop_id: str | None = Query(None),
    booking_date: str | None = Query(None),
    status: str | None = Query(None),
    phone: str | None = Query(None),
    pos_booking_code: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
    db: Session = Depends(get_db),
):
    suid = parse_uuid(shop_id, "shop") if shop_id else None
    bd = date.fromisoformat(booking_date) if booking_date else None

    service = BookingQueryService(db)
    return service.list_admin(
        shop_id=suid,
        booking_date=bd,
        status=status or None,
        phone=phone or None,
        pos_booking_code=pos_booking_code or None,
        limit=limit,
        cursor=cursor,
    )


# Chi tiết booking (admin) — kèm thông tin khách hàng, shop, reservation, course
@router.get("/{booking_id}", response_model=DataResponse[AdminBookingDetailResponse])
def get_admin_booking(booking_id: str, db: Session = Depends(get_db)):
    uid = parse_uuid(booking_id, "booking")
    service = BookingQueryService(db)
    return service.get_admin_detail(uid)


# Cập nhật hoặc hủy booking từ màn hình admin qua service sở hữu transaction.
@router.patch("/{booking_id}", response_model=DataResponse[PublicBookingResponse])
def update_admin_booking(
    booking_id: str,
    body: BookingPatchInput,
    db: Session = Depends(get_db),
):
    uid = parse_uuid(booking_id, "booking")
    service = BookingService(db)
    return DataResponse(data=PublicBookingResponse.model_validate(service.update(uid, body)))
