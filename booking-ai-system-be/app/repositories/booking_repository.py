# Repository cho Schedule (admin) — truy vấn tổng hợp một ngày nghiệp vụ
# chỉ làm data access, KHÔNG chứa business logic (nguyên tắc 4).
# Dùng joinedload để tránh N+1 query khi build timeline.
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models.booking import Booking
from app.db.models.reservation import Reservation
from app.db.models.reservation_course import ReservationCourse
from app.db.models.therapist import Therapist
from app.db.models.therapist_shift import TherapistShift


class BookingRepository:
    # Khởi tạo với session database
    def __init__(self, session: Session):
        self.session = session

    # Shop theo ID
    def find_shop(self, shop_id) -> object | None:
        from app.db.models.shop import Shop

        return self.session.get(Shop, shop_id)

    # Toàn bộ therapist của shop (kể cả không có ca) — để vẽ đủ resource row
    def find_therapists_by_shop(self, shop_id) -> list[Therapist]:
        stmt = (
            select(Therapist)
            .where(Therapist.shop_id == shop_id)
            .order_by(Therapist.name)
        )
        return list(self.session.scalars(stmt).all())

    # Ca làm việc trong shop theo ngày — kèm therapist (1 query, eager)
    def find_shifts(self, shop_id, work_date: date) -> list[TherapistShift]:
        stmt = (
            select(TherapistShift)
            .where(
                TherapistShift.shop_id == shop_id,
                TherapistShift.work_date == work_date,
            )
            .options(joinedload(TherapistShift.therapist))
            .order_by(TherapistShift.start_time)
        )
        return list(self.session.scalars(stmt).all())

    # Booking trong shop theo ngày — eager load reservations + therapist + courses (1 query)
    # Trả về TẤT CẢ booking (kể cả cancelled) để client tự lọc theo status.
    def find_bookings_with_reservations(
        self, shop_id, work_date: date
    ) -> list[Booking]:
        stmt = (
            select(Booking)
            .where(
                Booking.shop_id == shop_id,
                Booking.booking_date == work_date,
            )
            .options(
                joinedload(Booking.reservations)
                .joinedload(Reservation.therapist),
                joinedload(Booking.reservations)
                .joinedload(Reservation.reservation_courses),
                joinedload(Booking.customer),
            )
            .order_by(Booking.start_time)
        )
        return list(self.session.scalars(stmt).unique().all())

    # Tìm booking theo ID — eager load reservations + courses + customer
    def find_by_id(self, booking_id: UUID) -> Booking | None:
        stmt = (
            select(Booking)
            .where(Booking.booking_id == booking_id)
            .options(
                joinedload(Booking.reservations)
                .joinedload(Reservation.therapist),
                joinedload(Booking.reservations)
                .joinedload(Reservation.reservation_courses),
                joinedload(Booking.customer),
            )
        )
        return self.session.scalar(stmt)

    # Danh sách booking public — lọc theo phone, shop, ngày, status (cursor-based)
    def find_public_all(
        self,
        pos_booking_code: str | None = None,
        phone: str | None = None,
        shop_id: UUID | None = None,
        booking_date: date | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[Booking]:
        stmt = select(Booking).options(joinedload(Booking.customer))
        if pos_booking_code:
            stmt = stmt.where(Booking.pos_booking_code == pos_booking_code)
        if phone:
            stmt = stmt.join(Booking.customer).where(Booking.customer.has(phone=phone))
        if shop_id:
            stmt = stmt.where(Booking.shop_id == shop_id)
        if booking_date:
            stmt = stmt.where(Booking.booking_date == booking_date)
        if status:
            stmt = stmt.where(Booking.status == status)
        stmt = stmt.order_by(Booking.created_at.desc()).limit(limit)
        return list(self.session.scalars(stmt).unique().all())

    # Booking không cancelled trong shop theo ngày — cho availability check
    def find_by_shop_date_non_cancelled(self, shop_id: UUID, booking_date: date) -> list[Booking]:
        stmt = (
            select(Booking)
            .where(
                Booking.shop_id == shop_id,
                Booking.booking_date == booking_date,
                Booking.status != "cancelled",
            )
        )
        return list(self.session.scalars(stmt).all())

    # Tìm booking theo idempotency_key — chống tạo trùng
    def find_by_idempotency_key(self, idempotency_key: str) -> Booking | None:
        from uuid import UUID
        try:
            key_uuid = UUID(idempotency_key)
        except ValueError:
            return None
        stmt = select(Booking).where(Booking.idempotency_key == key_uuid)
        return self.session.scalar(stmt)

    # Lưu booking mới — add + flush
    def save(self, booking: Booking) -> Booking:
        self.session.add(booking)
        self.session.flush()
        return booking

    # Xóa booking theo ID (dùng cho hủy)
    def delete(self, booking_id: UUID) -> None:
        stmt = select(Booking).where(Booking.booking_id == booking_id)
        booking = self.session.scalar(stmt)
        if booking:
            self.session.delete(booking)
            self.session.flush()
