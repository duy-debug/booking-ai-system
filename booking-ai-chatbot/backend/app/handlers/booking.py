from typing import Any

from app.application.create_booking_flow import CreateBookingFlow
from app.application.lookup_booking_flow import LookupBookingFlow
from app.domain.intent import Intent
from app.domain.nlu import NLUResult


class BookingConversationHandler:
    # Nhận từng workflow qua constructor để handler chỉ chịu trách nhiệm dispatch intent.
    def __init__(
        self,
        create_booking_flow: CreateBookingFlow,
        lookup_booking_flow: LookupBookingFlow,
    ) -> None:
        self._create_booking_flow = create_booking_flow
        self._lookup_booking_flow = lookup_booking_flow

    # Chuyển từng booking intent sang workflow tương ứng, không gọi integration trực tiếp.
    async def handle(
        self,
        _query: str,
        nlu: NLUResult,
        conversation_id: str,
        selection: dict[str, Any] | None = None,
    ) -> dict:
        if nlu.intent is Intent.CREATE_BOOKING:
            return await self._create_booking_flow.handle(
                conversation_id=conversation_id,
                nlu=nlu,
                selection=selection,
            )
        if nlu.intent is Intent.LOOKUP_BOOKING:
            return await self._lookup_booking_flow.handle(
                conversation_id=conversation_id,
                nlu=nlu,
                selection=selection,
            )
        action = "đổi" if nlu.intent is Intent.UPDATE_BOOKING else "hủy"
        return {
            "answer": f"Vui lòng cung cấp mã booking và số điện thoại để {action} lịch.",
            "missing_entities": ["booking_id", "customer_phone"],
            "conversation_id": conversation_id,
        }
