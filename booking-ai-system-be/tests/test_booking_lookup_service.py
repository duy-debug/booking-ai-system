from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import AppError
from app.services.booking_query_service import BookingQueryService


# Xác nhận service chỉ trả booking khi repository đối chiếu đúng ID và số điện thoại.
def test_lookup_public_returns_mapped_booking_for_owner() -> None:
    booking_id = uuid4()
    booking = MagicMock()
    service = BookingQueryService(MagicMock())
    service.booking_repo.find_by_id_and_phone = MagicMock(return_value=booking)

    with patch(
        "app.services.booking_query_service.booking_to_public_response",
        return_value={"booking_id": str(booking_id)},
    ):
        result = service.lookup_public(booking_id, "0901234567")

    service.booking_repo.find_by_id_and_phone.assert_called_once_with(
        booking_id,
        "0901234567",
    )
    assert result.data == {"booking_id": str(booking_id)}


# Trả cùng lỗi 404 khi booking không tồn tại hoặc số điện thoại không thuộc booking.
def test_lookup_public_hides_phone_mismatch_reason() -> None:
    booking_id = uuid4()
    service = BookingQueryService(MagicMock())
    service.booking_repo.find_by_id_and_phone = MagicMock(return_value=None)

    with pytest.raises(AppError) as exc:
        service.lookup_public(booking_id, "0900000000")

    assert exc.value.status_code == 404
    assert exc.value.code == "BOOKING_NOT_FOUND_OR_PHONE_MISMATCH"

