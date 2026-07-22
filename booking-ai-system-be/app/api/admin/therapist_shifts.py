from datetime import date

from fastapi import APIRouter, Depends, Query
from app.core.exceptions import AppError
from app.core.auth import require_admin
from sqlalchemy.orm import Session

from app.api.deps import get_db, parse_uuid
from app.schemas.therapist_shift import ShiftCreate, ShiftResponse, ShiftUpdate
from app.schemas.common import CollectionResponse, DataResponse
from app.services.therapist_shift_service import TherapistShiftService

router = APIRouter(prefix="/api/admin", tags=["admin-shifts"], dependencies=[Depends(require_admin)])


# Danh sách ca làm việc trong shop — lọc theo ngày, therapist, trạng thái
@router.get(
    "/shops/{shop_id}/therapist-shifts",
    response_model=CollectionResponse[ShiftResponse],
)
def list_shifts(
    shop_id: str,
    work_date: str | None = Query(None),
    therapist_id: str | None = Query(None),
    is_active: bool | None = Query(None),
    db: Session = Depends(get_db),
):
    uid = parse_uuid(shop_id, "shop")

    parsed_date: date | None = None
    if work_date is not None:
        try:
            parsed_date = date.fromisoformat(work_date)
        except ValueError:
            raise AppError(400, code="INVALID_QUERY_PARAMETER", detail="work_date không đúng format YYYY-MM-DD")

    parsed_tid: str | None = None
    if therapist_id is not None:
        parsed_tid = parse_uuid(therapist_id, "therapist")

    service = TherapistShiftService(db)
    shifts = service.list(uid, work_date=parsed_date, therapist_id=parsed_tid, is_active=is_active)
    return CollectionResponse(data=[ShiftResponse.model_validate(shift) for shift in shifts])


# Tạo ca làm việc mới — kiểm tra therapist thuộc shop, không trùng giờ
@router.post(
    "/therapist-shifts",
    status_code=201,
    response_model=DataResponse[ShiftResponse],
)
def create_shift(body: ShiftCreate, db: Session = Depends(get_db)):
    service = TherapistShiftService(db)
    shift = service.create(body)
    return DataResponse(data=ShiftResponse.model_validate(shift))


# Chi tiết ca làm việc theo ID
@router.get(
    "/therapist-shifts/{shift_id}",
    response_model=DataResponse[ShiftResponse],
)
def get_shift(shift_id: str, db: Session = Depends(get_db)):
    uid = parse_uuid(shift_id, "shift")
    service = TherapistShiftService(db)
    shift = service.get(uid)
    return DataResponse(data=ShiftResponse.model_validate(shift))


# Cập nhật ca làm việc — kiểm tra overlap khi thay đổi giờ
@router.patch(
    "/therapist-shifts/{shift_id}",
    response_model=DataResponse[ShiftResponse],
)
def update_shift(shift_id: str, body: ShiftUpdate, db: Session = Depends(get_db)):
    uid = parse_uuid(shift_id, "shift")
    service = TherapistShiftService(db)
    shift = service.update(uid, body)
    return DataResponse(data=ShiftResponse.model_validate(shift))
