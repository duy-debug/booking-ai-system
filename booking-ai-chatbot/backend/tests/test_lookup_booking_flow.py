from unittest.mock import AsyncMock

import pytest

from app.application.lookup_booking_flow import LookupBookingFlow
from app.core.exceptions import AppError
from app.domain.intent import Intent
from app.domain.models import PendingAction
from app.domain.nlu import NLUResult
from app.domain.state import ConversationState, ConversationStep

BOOKING_ID = "6f1f99b2-b3f7-4d13-a95e-98e1c808a805"


class MemoryConversationStore:
    def __init__(self) -> None:
        self.states: dict[str, ConversationState] = {}
        self.pending: dict[str, PendingAction] = {}

    # Lưu state trong bộ nhớ để kiểm thử workflow độc lập với Redis.
    async def save_state(self, state: ConversationState) -> None:
        self.states[state.conversation_id] = state

    # Trả state hiện tại hoặc tạo state rỗng cho conversation mới.
    async def get_state(self, conversation_id: str) -> ConversationState:
        return self.states.get(
            conversation_id,
            ConversationState(conversation_id=conversation_id),
        )

    # Xóa state khi workflow không còn cần dữ liệu hội thoại.
    async def delete_state(self, conversation_id: str) -> None:
        self.states.pop(conversation_id, None)

    # Lưu pending action để đáp ứng đầy đủ ConversationStore contract.
    async def save_pending(self, action: PendingAction) -> None:
        self.pending[action.conversation_id] = action

    # Đọc pending action theo conversation.
    async def get_pending(self, conversation_id: str) -> PendingAction | None:
        return self.pending.get(conversation_id)

    # Xóa pending action cũ khi khách chuyển sang workflow tra cứu.
    async def delete_pending(self, conversation_id: str) -> None:
        self.pending.pop(conversation_id, None)


# Tạo NLU result cho lookup để test không phụ thuộc bộ phân loại từ khóa.
def lookup_nlu(**entities: str) -> NLUResult:
    return NLUResult(
        intent=Intent.LOOKUP_BOOKING,
        resource="booking",
        operation="lookup",
        entities=entities,
    )


# Yêu cầu frontend hiển thị form khi chưa có mã booking và số điện thoại.
@pytest.mark.asyncio
async def test_lookup_requests_structured_form_when_data_is_missing() -> None:
    store = MemoryConversationStore()
    gateway = AsyncMock()
    flow = LookupBookingFlow(store, gateway)

    result = await flow.handle("conversation-1", lookup_nlu())

    assert result["ui"]["type"] == "booking_lookup_form"
    assert result["missing_entities"] == ["booking_id", "customer_phone"]
    assert (
        store.states["conversation-1"].step
        is ConversationStep.LOOKUP_COLLECT_BOOKING_ID
    )
    gateway.lookup_booking.assert_not_awaited()


# Tra cứu thành công khi booking ID và số điện thoại cùng khớp.
@pytest.mark.asyncio
async def test_lookup_returns_booking_detail_for_owner() -> None:
    store = MemoryConversationStore()
    gateway = AsyncMock()
    gateway.lookup_booking.return_value = {
        "booking_id": BOOKING_ID,
        "status": "confirmed",
    }
    flow = LookupBookingFlow(store, gateway)

    result = await flow.handle(
        "conversation-1",
        lookup_nlu(),
        selection={
            "entity": "booking_lookup",
            "value": {
                "booking_id": BOOKING_ID,
                "phone": "0901234567",
            },
        },
    )

    gateway.lookup_booking.assert_awaited_once_with(BOOKING_ID, "0901234567")
    assert result["ui"]["type"] == "booking_detail"
    assert result["data"]["booking_id"] == BOOKING_ID
    assert store.states["conversation-1"].step is ConversationStep.COMPLETED
    assert "customer_phone" not in store.states["conversation-1"].entities


# Từ chối booking ID sai định dạng trước khi gọi Booking Backend.
@pytest.mark.asyncio
async def test_lookup_rejects_invalid_booking_id() -> None:
    store = MemoryConversationStore()
    gateway = AsyncMock()
    flow = LookupBookingFlow(store, gateway)

    with pytest.raises(AppError) as exc:
        await flow.handle(
            "conversation-1",
            lookup_nlu(),
            selection={
                "entity": "booking_lookup",
                "value": {
                    "booking_id": "booking-khong-hop-le",
                    "phone": "0901234567",
                },
            },
        )

    assert exc.value.code == "INVALID_BOOKING_ID"
    gateway.lookup_booking.assert_not_awaited()


# Giữ dữ liệu đã nhập khi Booking Backend từ chối để khách có thể sửa và thử lại.
@pytest.mark.asyncio
async def test_lookup_keeps_state_when_backend_rejects_access() -> None:
    store = MemoryConversationStore()
    gateway = AsyncMock()
    gateway.lookup_booking.side_effect = AppError(
        404,
        code="BOOKING_NOT_FOUND_OR_PHONE_MISMATCH",
        detail="Không tìm thấy booking phù hợp.",
    )
    flow = LookupBookingFlow(store, gateway)

    with pytest.raises(AppError):
        await flow.handle(
            "conversation-1",
            lookup_nlu(booking_id=BOOKING_ID, phone="0900000000"),
        )

    state = store.states["conversation-1"]
    assert state.entities["booking_id"] == BOOKING_ID
    assert state.entities["customer_phone"] == "0900000000"
    assert state.step is ConversationStep.IDLE

