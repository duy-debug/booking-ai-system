from datetime import date, time
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.exceptions import AppError
from app.schemas.booking import TherapistRequestInput
from app.services.booking_service import BookingService
from app.services.therapist_availability_service import TherapistAvailabilityService


SHOP_ID = uuid4()
BOOKING_DATE = date(2026, 7, 22)
START = time(14, 0)
END = time(15, 0)


def therapist(name, gender="female"):
    return SimpleNamespace(
        therapist_id=uuid4(),
        shop_id=SHOP_ID,
        name=name,
        gender=gender,
        is_active=True,
    )


def shift(person, start=START, end=END):
    return SimpleNamespace(therapist=person, start_time=start, end_time=end)


class ShiftRepo:
    def __init__(self, shifts, blocked=None):
        self.shifts = shifts
        self.blocked = set(blocked or [])

    def find_available_with_therapist(self, shop_id, booking_date, *, for_update=False):
        return self.shifts

    def exists_inactive_overlap(self, therapist_id, booking_date, start, end):
        return therapist_id in self.blocked

    def find_by_shop(
        self, shop_id, work_date=None, therapist_id=None, is_active=None
    ):
        return []


class ReservationRepo:
    def __init__(self, intervals=None):
        self.intervals = intervals or {}

    def exists_overlap(self, therapist_id, booking_date, start, end):
        return any(
            existing_start < end and existing_end > start
            for existing_start, existing_end in self.intervals.get(therapist_id, [])
        )

    def find_by_shop_date_non_cancelled(self, shop_id, booking_date):
        return []


def service(shifts, intervals=None, blocked=None):
    instance = TherapistAvailabilityService.__new__(TherapistAvailabilityService)
    instance.shift_repo = ShiftRepo(shifts, blocked)
    instance.reservation_repo = ReservationRepo(intervals)
    return instance


def evaluate(instance):
    return instance.evaluate(
        shop_id=SHOP_ID,
        booking_date=BOOKING_DATE,
        start_time=START,
        end_time=END,
    )


def test_group_two_available_with_a_and_b():
    a, b = therapist("A"), therapist("B")
    assert evaluate(service([shift(a), shift(b)])).available_therapist_count == 2


def test_group_two_insufficient_with_only_a():
    a = therapist("A")
    assert evaluate(service([shift(a)])).available_therapist_count == 1


def test_group_three_available_with_a_b_and_c():
    people = [therapist(name) for name in ("A", "B", "C")]
    result = evaluate(service([shift(person) for person in people]))
    assert result.available_therapist_count == 3


def test_overlap_is_checked_per_therapist():
    a, b, c = therapist("A"), therapist("B"), therapist("C")
    result = evaluate(
        service(
            [shift(a), shift(b), shift(c)],
            {a.therapist_id: [(time(14, 15), time(14, 45))]},
        )
    )
    assert {t.therapist_id for t in result.available_therapists} == {
        b.therapist_id,
        c.therapist_id,
    }


def test_partial_shift_does_not_count():
    a, b = therapist("A"), therapist("B")
    result = evaluate(service([shift(a, end=time(14, 30)), shift(b)]))
    assert [t.therapist_id for t in result.available_therapists] == [b.therapist_id]


def test_duplicate_shifts_count_therapist_once():
    a, b = therapist("A"), therapist("B")
    result = evaluate(service([shift(a), shift(a), shift(b)]))
    assert result.available_therapist_count == 2


def test_touching_booking_boundary_does_not_overlap():
    a = therapist("A")
    result = evaluate(
        service(
            [shift(a)],
            {a.therapist_id: [(time(13, 0), START), (END, time(16, 0))]},
        )
    )
    assert result.available_therapist_count == 1


def test_day_context_bulk_loads_once_and_evaluates_without_more_queries():
    a, b = therapist("A"), therapist("B")

    class CountingShiftRepo(ShiftRepo):
        def __init__(self):
            super().__init__([shift(a), shift(b)])
            self.calls = 0

        def find_available_with_therapist(
            self, shop_id, booking_date, *, for_update=False
        ):
            self.calls += 1
            return self.shifts

        def find_by_shop(
            self, shop_id, work_date=None, therapist_id=None, is_active=None
        ):
            self.calls += 1
            return []

        def exists_inactive_overlap(self, *args, **kwargs):
            raise AssertionError("context evaluation must not query blocked shifts")

    class CountingReservationRepo(ReservationRepo):
        def __init__(self):
            super().__init__()
            self.calls = 0

        def find_by_shop_date_non_cancelled(self, shop_id, booking_date):
            self.calls += 1
            return []

        def exists_overlap(self, *args, **kwargs):
            raise AssertionError("context evaluation must not query overlaps")

    instance = TherapistAvailabilityService.__new__(TherapistAvailabilityService)
    instance.shift_repo = CountingShiftRepo()
    instance.reservation_repo = CountingReservationRepo()
    context = instance.load_day_context(SHOP_ID, BOOKING_DATE)

    for start, end in ((time(14, 0), time(15, 0)), (time(14, 15), time(14, 45))):
        result = instance.evaluate(
            shop_id=SHOP_ID,
            booking_date=BOOKING_DATE,
            start_time=start,
            end_time=end,
            context=context,
        )
        assert result.available_therapist_count == 2

    assert instance.shift_repo.calls == 2
    assert instance.reservation_repo.calls == 1


def booking_service_with_availability(availability):
    instance = BookingService.__new__(BookingService)
    instance.availability_service = availability
    return instance


def test_group_specific_request_is_rejected():
    a, b = therapist("A"), therapist("B")
    instance = booking_service_with_availability(service([shift(a), shift(b)]))
    request = TherapistRequestInput(type="specific", therapist_id=a.therapist_id)
    with pytest.raises(AppError) as error:
        instance._resolve_therapists(
            SHOP_ID, BOOKING_DATE, START, END, 2, request
        )
    assert error.value.detail["code"] == "GROUP_BOOKING_CANNOT_REQUEST_SPECIFIC_THERAPIST"


def test_create_resolution_never_repeats_a():
    a, b = therapist("A"), therapist("B")
    instance = booking_service_with_availability(service([shift(a), shift(a), shift(b)]))
    assigned = instance._resolve_therapists(
        SHOP_ID, BOOKING_DATE, START, END, 2, TherapistRequestInput(type="none")
    )
    assert assigned == [a.therapist_id, b.therapist_id]


def test_availability_and_create_use_same_result():
    a = therapist("A")
    availability = service([shift(a)])
    assert evaluate(availability).available_therapist_count == 1
    instance = booking_service_with_availability(availability)
    with pytest.raises(AppError) as error:
        instance._resolve_therapists(
            SHOP_ID, BOOKING_DATE, START, END, 2, TherapistRequestInput(type="none")
        )
    assert error.value.detail["code"] == "INSUFFICIENT_AVAILABLE_THERAPISTS"


def test_group_update_keeps_parallel_duration(monkeypatch):
    reservations = [
        SimpleNamespace(
            start_time=START,
            end_time=END,
            reservation_courses=[SimpleNamespace(duration_snapshot=60)],
        )
        for _ in range(3)
    ]
    booking = SimpleNamespace(
        booking_date=BOOKING_DATE,
        start_time=START,
        end_time=END,
        total_duration_minutes=60,
        reservations=reservations,
    )
    instance = BookingService.__new__(BookingService)
    instance.schedule_repo = SimpleNamespace(find_by_id=lambda booking_id: booking)
    instance.session = SimpleNamespace(flush=lambda: None)
    monkeypatch.setattr(
        "app.services.booking_service._booking_to_detail", lambda value: value
    )
    body = SimpleNamespace(
        status=None,
        booking_date=None,
        start_time=time(16, 0),
    )
    result = instance._update(uuid4(), body)
    assert result.end_time == time(17, 0)
    assert all(res.end_time == time(17, 0) for res in reservations)
