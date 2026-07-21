from datetime import date, datetime, time, timedelta
from uuid import UUID

# Service tổng hợp lịch theo ngày nghiệp vụ (resource timeline).
# Quản lý orchestration + transaction, KHÔNG chứa business rule phân tán (nguyên tắc 3).
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError
from app.db.models.booking import Booking
from app.db.models.customer import Customer
from app.db.models.reservation import Reservation
from app.db.models.reservation_course import ReservationCourse
from app.repositories import (
    BookingRepository,
    ShopRepository,
    CourseRepository,
    CustomerRepository,
    ReservationRepository,
    ShiftRepository,
    TherapistRepository,
)
from app.schemas.booking import (
    BookingCreate,
    BookingPatchInput,
)
from app.services.booking_time import validate_booking_start


def _to_hhmm(value) -> str:
    # time/Time -> "HH:MM" (bỏ giây)
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return str(value)


def _spans_midnight(start: str, end: str) -> bool:
    # So sánh "HH:MM": nếu end < start => qua nửa đêm
    try:
        sh, sm = (int(x) for x in start.split(":"))
        eh, em = (int(x) for x in end.split(":"))
    except ValueError:
        return False
    return (eh * 60 + em) < (sh * 60 + sm)


def _add_minutes_to_time(t: time, minutes: int) -> time:
    """Cộng thêm phút vào time, xử lý qua nửa đêm."""
    total = t.hour * 60 + t.minute + minutes
    return time((total // 60) % 24, total % 60)


def _booking_to_detail(booking: Booking) -> dict:
    """Format một Booking thành dict response chi tiết."""
    res_list = []
    for res in booking.reservations:
        courses = [
            {
                "course_id": str(c.course_id),
                "course_role": c.course_role,
                "course_name_snapshot": c.course_name_snapshot,
                "duration_snapshot": c.duration_snapshot,
                "price_snapshot": float(c.price_snapshot),
            }
            for c in res.reservation_courses
        ]
        res_list.append({
            "reservation_id": str(res.reservation_id),
            "person_index": res.person_index,
            "therapist_id": str(res.therapist_id),
            "therapist_name": res.therapist.name if res.therapist else None,
            "start_time": _to_hhmm(res.start_time),
            "end_time": _to_hhmm(res.end_time),
            "status": res.status,
            "spans_midnight": _spans_midnight(
                _to_hhmm(res.start_time), _to_hhmm(res.end_time)
            ),
            "courses": courses,
        })
    return {
        "booking_id": str(booking.booking_id),
        "pos_booking_code": booking.pos_booking_code,
        "shop_id": str(booking.shop_id),
        "customer": {
            "customer_id": str(booking.customer.customer_id) if booking.customer else None,
            "phone": booking.customer.phone if booking.customer else None,
            "name": booking.customer.name if booking.customer else None,
        },
        "booking_date": booking.booking_date.isoformat(),
        "start_time": _to_hhmm(booking.start_time),
        "end_time": _to_hhmm(booking.end_time),
        "number_of_people": booking.number_of_people,
        "total_duration_minutes": booking.total_duration_minutes,
        "status": booking.status,
        "therapist_request_type": booking.therapist_request_type,
        "requested_therapist_id": (
            str(booking.requested_therapist_id) if booking.requested_therapist_id else None
        ),
        "cancel_reason": booking.cancel_reason,
        "cancelled_at": booking.cancelled_at.isoformat() if booking.cancelled_at else None,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "updated_at": booking.updated_at.isoformat() if booking.updated_at else None,
        "spans_midnight": _spans_midnight(
            _to_hhmm(booking.start_time), _to_hhmm(booking.end_time)
        ),
        "reservations": res_list,
    }


class BookingService:
    # Khởi tạo với session và repository
    def __init__(self, session: Session):
        self.session = session
        self.schedule_repo = BookingRepository(session)
        self.shop_repo = ShopRepository(session)
        self.course_repo = CourseRepository(session)
        self.customer_repo = CustomerRepository(session)
        self.reservation_repo = ReservationRepository(session)
        self.shift_repo = ShiftRepository(session)
        self.therapist_repo = TherapistRepository(session)

    # ── Tạo booking mới ──────────────────────────────────────────────
    def create(self, body: BookingCreate, idempotency_key: str) -> dict:
        shop = self.shop_repo.find_by_id(body.shop_id)
        if not shop:
            raise AppError(404, code="SHOP_NOT_FOUND", detail="Không tìm thấy shop")
        if not shop.is_active:
            raise AppError(422, code="SHOP_INACTIVE", detail="Shop không hoạt động")

        # booking_date/start_time là giá trị local của shop trong DB. Ghép chúng với
        # timezone shop rồi so sánh ở UTC trước mọi kiểm tra availability khác.
        validate_booking_start(body.booking_date, body.start_time)

        # Kiểm tra idempotency key trùng
        existing = self.schedule_repo.find_by_idempotency_key(idempotency_key)
        if existing:
            raise AppError(409, code="IDEMPOTENCY_CONFLICT",
                           detail="Idempotency-Key đã tồn tại")

        # Tìm hoặc tạo customer
        customer = self.customer_repo.find_by_phone(body.customer.phone)
        if not customer:
            customer = self.customer_repo.save(Customer(
                phone=body.customer.phone,
                name=body.customer.name,
            ))
        elif body.customer.name and customer.name != body.customer.name:
            customer.name = body.customer.name
            self.session.flush()

        # Validate courses + tính tổng thời lượng
        main_course = None
        total_duration = 0
        for c in body.courses:
            course = self.course_repo.find_by_id(c.course_id)
            if not course or course.shop_id != body.shop_id:
                raise AppError(404, code="COURSE_NOT_FOUND",
                               detail=f"Không tìm thấy course {c.course_id}")
            if c.course_role == "main":
                if main_course:
                    raise AppError(422, code="INVALID_COURSE_COMBO",
                                   detail="Chỉ được một course chính")
                if course.course_type != "main":
                    raise AppError(422, code="INVALID_COURSE_COMBO",
                                   detail=f"{c.course_id} không phải course type 'main'")
                main_course = course
            elif c.course_role == "addon":
                if course.course_type != "addon":
                    raise AppError(422, code="INVALID_COURSE_COMBO",
                                   detail=f"{c.course_id} không phải course type 'addon'")
            total_duration += course.duration_minutes
        if not main_course:
            raise AppError(422, code="INVALID_COURSE_COMBO", detail="Thiếu course chính")

        # Tính end_time
        end_time = _add_minutes_to_time(body.start_time, total_duration)

        # Xác định therapist cho mỗi người
        therapist_ids = self._resolve_therapists(
            shop_id=body.shop_id,
            booking_date=body.booking_date,
            start_time=body.start_time,
            end_time=end_time,
            number_of_people=body.number_of_people,
            therapist_request=body.therapist_request,
        )

        # Tạo booking
        booking = Booking(
            shop_id=body.shop_id,
            customer_id=customer.customer_id,
            booking_date=body.booking_date,
            start_time=body.start_time,
            end_time=end_time,
            number_of_people=body.number_of_people,
            total_duration_minutes=total_duration,
            status="confirmed",
            therapist_request_type=body.therapist_request.type if body.therapist_request else "none",
            requested_therapist_id=(
                body.therapist_request.therapist_id
                if body.therapist_request and body.therapist_request.type == "specific"
                else None
            ),
            requested_gender=(
                body.therapist_request.gender
                if body.therapist_request and body.therapist_request.type == "gender"
                else None
            ),
            idempotency_key=idempotency_key,
        )
        self.schedule_repo.save(booking)

        # Tạo reservation cho mỗi người
        for i in range(body.number_of_people):
            tid = therapist_ids[i] if i < len(therapist_ids) else therapist_ids[0]
            reservation = Reservation(
                booking_id=booking.booking_id,
                person_index=i + 1,
                therapist_id=tid,
                start_time=body.start_time,
                end_time=end_time,
                status="assigned",
            )
            self.reservation_repo.save(reservation)

            # Tạo snapshot course cho mỗi reservation
            for c in body.courses:
                course = self.course_repo.find_by_id(c.course_id)
                snap = ReservationCourse(
                    reservation_id=reservation.reservation_id,
                    course_id=c.course_id,
                    course_role=c.course_role,
                    course_name_snapshot=course.name,
                    duration_snapshot=course.duration_minutes,
                    price_snapshot=course.price,
                )
                self.session.add(snap)

        self.session.flush()
        return _booking_to_detail(booking)

    # ── Lấy chi tiết booking ──────────────────────────────────────────
    def get(self, booking_id: UUID) -> dict:
        booking = self.schedule_repo.find_by_id(booking_id)
        if not booking:
            raise AppError(404, code="BOOKING_NOT_FOUND", detail="Không tìm thấy booking")
        return _booking_to_detail(booking)

    # ── Cập nhật booking ──────────────────────────────────────────────
    def update(self, booking_id: UUID, body: BookingPatchInput) -> dict:
        try:
            result = self._update(booking_id, body)
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise

    def _update(self, booking_id: UUID, body: BookingPatchInput) -> dict:
        booking = self.schedule_repo.find_by_id(booking_id)
        if not booking:
            raise AppError(404, code="BOOKING_NOT_FOUND", detail="Không tìm thấy booking")

        # Huỷ booking
        if body.status == "cancelled":
            booking.status = "cancelled"
            booking.cancel_reason = body.cancel_reason
            booking.cancelled_at = datetime.now()
            self.session.flush()
            return _booking_to_detail(booking)

        # Thay đổi ngày/giờ
        if body.booking_date is not None:
            booking.booking_date = body.booking_date
        if body.start_time is not None:
            booking.start_time = body.start_time
            # Tính lại end_time từ courses snapshot
            total = 0
            for res in booking.reservations:
                for rc in res.reservation_courses:
                    total += rc.duration_snapshot
            booking.end_time = _add_minutes_to_time(body.start_time, total or booking.total_duration_minutes)

        self.session.flush()
        return _booking_to_detail(booking)

    # ── Internal: chọn therapist ──────────────────────────────────────
    def _resolve_therapists(
        self,
        shop_id: UUID,
        booking_date: date,
        start_time: time,
        end_time: time,
        number_of_people: int,
        therapist_request=None,
    ) -> list[UUID]:
        if therapist_request and therapist_request.type == "specific" and therapist_request.therapist_id:
            return [therapist_request.therapist_id] * number_of_people

        shifts = self.shift_repo.find_available_with_therapist(shop_id, booking_date)
        candidates = []
        for shift in shifts:
            t = shift.therapist
            if not t.is_active:
                continue
            if shift.start_time <= start_time and shift.end_time >= end_time:
                overlap = self.reservation_repo.exists_overlap(
                    t.therapist_id, booking_date, start_time, end_time
                )
                if not overlap:
                    if therapist_request and therapist_request.type == "gender" and therapist_request.gender:
                        if t.gender == therapist_request.gender:
                            candidates.append(t.therapist_id)
                    else:
                        candidates.append(t.therapist_id)

        if not candidates:
            raise AppError(422, code="THERAPIST_NOT_AVAILABLE",
                           detail="Không có therapist khả dụng trong khung giờ")

        if number_of_people <= len(candidates):
            return candidates[:number_of_people]
        # Nhóm > số therapist — lấy therapist đầu cho tất cả (phòng chờ)
        return [candidates[0]] * number_of_people

    # Lấy toàn bộ dữ liệu timeline trong một ngày nghiệp vụ, gom 1 request.
    def get_schedule(
        self,
        shop_id,
        schedule_date: date,
        view_from: str | None = None,
        view_to: str | None = None,
    ) -> dict:
        shop = self.shop_repo.find_by_id(shop_id)
        if not shop:
            raise AppError(404, code="SHOP_NOT_FOUND", detail="Khong tim thay shop")

        therapists = self.schedule_repo.find_therapists_by_shop(shop_id)
        shifts = self.schedule_repo.find_shifts(shop_id, schedule_date)
        bookings = self.schedule_repo.find_bookings_with_reservations(
            shop_id, schedule_date
        )

        # Khung giờ hoạt động (business hours) = min/max ca active trong ngày.
        active_shifts = [s for s in shifts if s.is_active]
        if active_shifts:
            opens = min(_to_hhmm(s.start_time) for s in active_shifts)
            closes = max(_to_hhmm(s.end_time) for s in active_shifts)
        else:
            opens = settings.BUSINESS_HOURS_OPEN
            closes = settings.BUSINESS_HOURS_CLOSE
        business_hours = {
            "open": opens,
            "close": closes,
            "spans_midnight": _spans_midnight(opens, closes),
        }

        # Cửa sổ hiển thị (view window) do client truyền, mặc định = business hours.
        v_from = view_from or opens
        v_to = view_to or closes
        view_window = {
            "from": v_from,
            "to": v_to,
            "spans_midnight": _spans_midnight(v_from, v_to),
        }

        # Blocked ranges: ánh xạ các ca INACTIVE thành đoạn bị chặn của therapist.
        # (Hiện tại DB chưa có bảng blocked_ranges riêng; dùng inactive shift thay thế.
        #  Khuyến nghị: bổ sung bảng blocked_ranges trong migration sau.)
        blocked_ranges = [
            {
                "therapist_id": str(s.therapist_id),
                "therapist_name": s.therapist.name if s.therapist else None,
                "start_time": _to_hhmm(s.start_time),
                "end_time": _to_hhmm(s.end_time),
                "spans_midnight": _spans_midnight(
                    _to_hhmm(s.start_time), _to_hhmm(s.end_time)
                ),
                "reason": None,
            }
            for s in shifts
            if not s.is_active
        ]

        therapist_list = [
            {
                "therapist_id": str(t.therapist_id),
                "name": t.name,
                "gender": t.gender,
                "is_active": t.is_active,
            }
            for t in therapists
        ]

        shift_list = [
            {
                "shift_id": str(s.shift_id),
                "therapist_id": str(s.therapist_id),
                "therapist_name": s.therapist.name if s.therapist else None,
                "start_time": _to_hhmm(s.start_time),
                "end_time": _to_hhmm(s.end_time),
                "is_active": s.is_active,
                "spans_midnight": _spans_midnight(
                    _to_hhmm(s.start_time), _to_hhmm(s.end_time)
                ),
            }
            for s in shifts
        ]

        booking_list = []
        statuses: set[str] = set()
        for b in bookings:
            statuses.add(b.status)
            res_list = []
            for res in b.reservations:
                courses = [
                    {
                        "course_role": c.course_role,
                        "course_name_snapshot": c.course_name_snapshot,
                        "duration_snapshot": c.duration_snapshot,
                        "price_snapshot": float(c.price_snapshot),
                    }
                    for c in res.reservation_courses
                ]
                res_list.append({
                    "reservation_id": str(res.reservation_id),
                    "person_index": res.person_index,
                    "therapist_id": str(res.therapist_id),
                    "therapist_name": res.therapist.name if res.therapist else None,
                    "start_time": _to_hhmm(res.start_time),
                    "end_time": _to_hhmm(res.end_time),
                    "status": res.status,
                    "spans_midnight": _spans_midnight(
                        _to_hhmm(res.start_time), _to_hhmm(res.end_time)
                    ),
                    "courses": courses,
                })
            booking_list.append({
                "booking_id": str(b.booking_id),
                "pos_booking_code": b.pos_booking_code,
                "customer": {
                    "customer_id": str(b.customer.customer_id) if b.customer else None,
                    "phone": b.customer.phone if b.customer else None,
                    "name": b.customer.name if b.customer else None,
                },
                "booking_date": b.booking_date.isoformat(),
                "start_time": _to_hhmm(b.start_time),
                "end_time": _to_hhmm(b.end_time),
                "status": b.status,
                "number_of_people": b.number_of_people,
                "total_duration_minutes": b.total_duration_minutes,
                "therapist_request_type": b.therapist_request_type,
                "requested_therapist_id": (
                    str(b.requested_therapist_id) if b.requested_therapist_id else None
                ),
                "spans_midnight": _spans_midnight(
                    _to_hhmm(b.start_time), _to_hhmm(b.end_time)
                ),
                "reservations": res_list,
            })

        return {
            "shop": {
                "shop_id": str(shop.shop_id),
                "name": shop.name,
                "timezone": settings.SHOP_TIMEZONE,
                "minimum_booking_advance_minutes": settings.MINIMUM_BOOKING_ADVANCE_MINUTES,
                "business_hours": business_hours,
            },
            "date": schedule_date.isoformat(),
            "view_window": view_window,
            "therapists": therapist_list,
            "shifts": shift_list,
            "blocked_ranges": blocked_ranges,
            "bookings": booking_list,
            "booking_statuses": sorted(statuses),
        }
