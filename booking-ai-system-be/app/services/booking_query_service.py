from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.repositories import (
    BookingRepository,
    ReservationRepository,
)
from app.schemas.booking import (
    AdminBookingDetailResponse,
    AdminBookingListResponse,
    PublicBookingListItem,
    PublicBookingResponse,
    ReservationResponse,
)
from app.mappers.booking_mapper import (
    booking_to_public_response,
    reservation_to_response,
)
from app.schemas.common import CollectionResponse, DataResponse, PaginatedResponse, PaginationMeta


class BookingQueryService:
    # Khởi tạo các repository chỉ đọc cần cho danh sách và chi tiết booking.
    def __init__(self, session: Session):
        self.booking_repo = BookingRepository(session)
        self.reservation_repo = ReservationRepository(session)

    # Truy vấn danh sách booking admin theo bộ lọc và trả DTO phân trang thay vì ORM model.
    def list_admin(
        self,
        *,
        shop_id: UUID | None = None,
        booking_date: date | None = None,
        status: str | None = None,
        phone: str | None = None,
        pos_booking_code: str | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> PaginatedResponse[AdminBookingListResponse]:
        bookings = self.booking_repo.find_admin_all(
            shop_id=shop_id,
            booking_date=booking_date,
            status=status,
            phone=phone,
            pos_booking_code=pos_booking_code,
            limit=limit + 1,
            cursor=self._parse_cursor(cursor),
        )
        has_more = len(bookings) > limit
        page = bookings[:limit]
        data = [
            AdminBookingListResponse.model_validate({
                "booking_id": booking.booking_id,
                "pos_booking_code": booking.pos_booking_code,
                "shop_id": booking.shop_id,
                "customer": (
                    {
                        "customer_id": booking.customer.customer_id,
                        "phone": booking.customer.phone,
                        "name": booking.customer.name,
                    }
                    if booking.customer
                    else None
                ),
                "booking_date": booking.booking_date,
                "start_time": booking.start_time,
                "end_time": booking.end_time,
                "number_of_people": booking.number_of_people,
                "status": booking.status,
            })
            for booking in page
        ]
        return PaginatedResponse(
            data=data,
            meta=PaginationMeta(
                limit=limit,
                next_cursor=str(page[-1].booking_id) if has_more and page else None,
            ),
        )

    # Lấy chi tiết booking admin và gom shop, customer, reservation, course thành một DTO độc lập ORM.
    def get_admin_detail(self, booking_id: UUID) -> DataResponse[AdminBookingDetailResponse]:
        booking = self._require_booking(booking_id)
        shop = booking.shop
        customer = booking.customer
        reservations = booking.reservations
        detail = AdminBookingDetailResponse.model_validate({
            "booking_id": booking.booking_id,
            "pos_booking_code": booking.pos_booking_code,
            "status": booking.status,
            "shop": {
                "shop_id": shop.shop_id if shop else None,
                "name": shop.name if shop else None,
            },
            "customer": (
                {
                    "customer_id": customer.customer_id,
                    "phone": customer.phone,
                    "name": customer.name,
                    "is_member": customer.is_member,
                    "member_rank": customer.member_rank,
                    "visit_count": customer.visit_count,
                }
                if customer
                else None
            ),
            "booking_date": booking.booking_date,
            "start_time": booking.start_time,
            "end_time": booking.end_time,
            "number_of_people": booking.number_of_people,
            "total_duration_minutes": booking.total_duration_minutes,
            "reservations": [
                {
                    "reservation_id": reservation.reservation_id,
                    "person_index": reservation.person_index,
                    "therapist": {
                        "therapist_id": reservation.therapist_id,
                        "name": reservation.therapist.name if reservation.therapist else None,
                    },
                    "courses": [
                        {
                            "course_id": course.course_id,
                            "course_role": course.course_role,
                            "course_name_snapshot": course.course_name_snapshot,
                            "duration_snapshot": course.duration_snapshot,
                            "price_snapshot": course.price_snapshot,
                        }
                        for course in reservation.reservation_courses
                    ],
                }
                for reservation in reservations
            ],
        })
        return DataResponse(data=detail)

    # Truy vấn danh sách booking public và trả DTO phân trang không chứa field nội bộ của POS.
    def list_public(
        self,
        *,
        pos_booking_code: str | None = None,
        phone: str | None = None,
        shop_id: UUID | None = None,
        booking_date: date | None = None,
        status: str | None = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> PaginatedResponse[PublicBookingListItem]:
        bookings = self.booking_repo.find_public_all(
            pos_booking_code=pos_booking_code,
            phone=phone,
            shop_id=shop_id,
            booking_date=booking_date,
            status=status,
            limit=limit + 1,
            cursor=self._parse_cursor(cursor),
        )
        has_more = len(bookings) > limit
        page = bookings[:limit]
        return PaginatedResponse(
            data=[PublicBookingListItem.model_validate(booking) for booking in page],
            meta=PaginationMeta(
                limit=limit,
                next_cursor=str(page[-1].booking_id) if has_more and page else None,
            ),
        )

    # Lấy chi tiết public và ánh xạ toàn bộ relationship sang Pydantic response.
    def get_public_detail(self, booking_id: UUID) -> DataResponse[PublicBookingResponse]:
        return DataResponse(data=booking_to_public_response(self._require_booking(booking_id)))

    # Tra cứu booking công khai khi ID và số điện thoại cùng thuộc một customer.
    def lookup_public(
        self,
        booking_id: UUID,
        phone: str,
    ) -> DataResponse[PublicBookingResponse]:
        booking = self.booking_repo.find_by_id_and_phone(booking_id, phone)
        if booking is None:
            raise AppError(
                404,
                code="BOOKING_NOT_FOUND_OR_PHONE_MISMATCH",
                detail="Không tìm thấy booking phù hợp với thông tin đã cung cấp",
            )
        return DataResponse(data=booking_to_public_response(booking))

    # Lấy danh sách reservation của booking và ánh xạ course relationship thành DTO.
    def list_reservations(self, booking_id: UUID) -> CollectionResponse[ReservationResponse]:
        self._require_booking(booking_id)
        reservations = self.reservation_repo.find_by_booking(booking_id)
        return CollectionResponse(
            data=[reservation_to_response(reservation) for reservation in reservations]
        )

    # Trả booking bắt buộc tồn tại để các query dùng chung quy tắc lỗi 404.
    def _require_booking(self, booking_id: UUID):
        booking = self.booking_repo.find_by_id(booking_id)
        if not booking:
            raise AppError(404, code="BOOKING_NOT_FOUND", detail="Không tìm thấy booking")
        return booking

    # Chuyển cursor chuỗi thành UUID và trả lỗi nghiệp vụ rõ ràng nếu client gửi sai định dạng.
    def _parse_cursor(self, cursor: str | None) -> UUID | None:
        if cursor is None:
            return None
        try:
            return UUID(cursor)
        except ValueError:
            raise AppError(
                400,
                code="INVALID_CURSOR",
                detail="cursor không đúng định dạng UUID",
            )
