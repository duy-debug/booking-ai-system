from datetime import date, time
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.exceptions import AppError
from app.schemas.booking import BookingPatchInput, TherapistRequestInput
from app.repositories.reservation_repository import ReservationRepository
from app.services.booking_service import BookingService
from app.services.slot_service import SlotService
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
            reservation_courses=[
                SimpleNamespace(
                    course_id=uuid4(), course_role="main", duration_snapshot=60
                )
            ],
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
    instance.booking_repo = SimpleNamespace(
        find_by_id=lambda booking_id: booking,
        save=lambda value: value,
    )
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


def test_existing_group_cannot_change_therapists_manually(monkeypatch):
    first_id, second_id = uuid4(), uuid4()
    old_therapists = [uuid4(), uuid4()]
    reservations = [
        SimpleNamespace(
            reservation_id=reservation_id,
            person_index=index,
            therapist_id=old_therapists[index - 1],
            start_time=START,
            end_time=END,
            status="assigned",
            reservation_courses=[
                SimpleNamespace(
                    course_id=uuid4(), course_role="main", duration_snapshot=60
                )
            ],
        )
        for index, reservation_id in enumerate((first_id, second_id), start=1)
    ]
    booking_id = uuid4()
    booking = SimpleNamespace(
        booking_id=booking_id,
        shop_id=SHOP_ID,
        booking_date=BOOKING_DATE,
        start_time=START,
        end_time=END,
        number_of_people=2,
        total_duration_minutes=60,
        reservations=reservations,
        customer_id=uuid4(),
        customer=None,
    )
    new_therapists = [therapist("New A"), therapist("New B")]
    course_60 = SimpleNamespace(
        course_id=uuid4(), shop_id=SHOP_ID, name="60", duration_minutes=60,
        price=100, course_type="main", is_active=True,
    )

    instance = BookingService.__new__(BookingService)
    instance.booking_repo = SimpleNamespace(
        find_by_id=lambda value: booking,
        save=lambda value: value,
    )
    instance.customer_repo = SimpleNamespace()
    instance.therapist_repo = SimpleNamespace(
        find_by_id=lambda value: next(t for t in new_therapists if t.therapist_id == value)
    )
    instance.course_repo = SimpleNamespace(
        find_by_id=lambda value: course_60
    )
    instance.shift_repo = SimpleNamespace(
        find_by_shop=lambda *args, **kwargs: [SimpleNamespace(start_time=time(9), end_time=time(18))],
        exists_inactive_overlap=lambda *args, **kwargs: False,
    )
    instance.reservation_repo = SimpleNamespace(
        exists_overlap=lambda *args, **kwargs: False,
        delete=lambda value: None,
        save=lambda value: value,
    )
    instance.session = SimpleNamespace(flush=lambda: None, delete=lambda value: None)
    monkeypatch.setattr("app.services.booking_service._booking_to_detail", lambda value: value)

    body = BookingPatchInput(
        reservations=[
            {
                "reservation_id": str(first_id),
                "person_index": 1,
                "therapist_id": str(new_therapists[0].therapist_id),
                "courses": [{"course_id": str(course_60.course_id), "course_role": "main"}],
            },
            {
                "reservation_id": str(second_id),
                "person_index": 2,
                "therapist_id": str(new_therapists[1].therapist_id),
                "courses": [{"course_id": str(course_60.course_id), "course_role": "main"}],
            },
        ]
    )

    with pytest.raises(AppError) as error:
        instance._update(booking_id, body)

    assert error.value.detail["code"] == "GROUP_BOOKING_CANNOT_CHANGE_THERAPIST"


def test_group_update_rejects_different_courses_between_people():
    reservation_ids = [uuid4(), uuid4()]
    booking = SimpleNamespace(
        booking_id=uuid4(),
        booking_date=BOOKING_DATE,
        start_time=START,
        reservations=[
            SimpleNamespace(reservation_id=reservation_ids[0]),
            SimpleNamespace(reservation_id=reservation_ids[1]),
        ],
    )
    therapist_ids = [uuid4(), uuid4()]
    main_course_ids = [uuid4(), uuid4()]
    body = BookingPatchInput(
        reservations=[
            {
                "reservation_id": str(reservation_ids[0]),
                "person_index": 1,
                "therapist_id": str(therapist_ids[0]),
                "courses": [
                    {"course_id": str(main_course_ids[0]), "course_role": "main"}
                ],
            },
            {
                "reservation_id": str(reservation_ids[1]),
                "person_index": 2,
                "therapist_id": str(therapist_ids[1]),
                "courses": [
                    {"course_id": str(main_course_ids[1]), "course_role": "main"}
                ],
            },
        ]
    )
    instance = BookingService.__new__(BookingService)
    instance.booking_repo = SimpleNamespace(find_by_id=lambda value: booking)

    with pytest.raises(AppError) as error:
        instance._update(booking.booking_id, body)

    assert error.value.detail["code"] == "GROUP_COURSES_MUST_MATCH"


def test_overlap_query_excludes_cancelled_bookings():
    class CapturingSession:
        statement = None

        def scalar(self, statement):
            self.statement = statement
            return None

    session = CapturingSession()
    repository = ReservationRepository(session)

    assert repository.exists_overlap(
        uuid4(), BOOKING_DATE, time(14), time(15)
    ) is False
    sql = str(session.statement.compile(compile_kwargs={"literal_binds": True})).lower()
    assert "bookings.status != 'cancelled'" in sql


def test_single_to_group_requires_auto_assignment():
    booking = SimpleNamespace(
        booking_id=uuid4(),
        booking_date=BOOKING_DATE,
        start_time=START,
        number_of_people=1,
    )
    course_id = uuid4()
    body = BookingPatchInput(
        reservations=[
            {"person_index": index, "courses": [{"course_id": course_id, "course_role": "main"}]}
            for index in (1, 2)
        ]
    )
    instance = BookingService.__new__(BookingService)
    instance.booking_repo = SimpleNamespace(find_by_id=lambda value: booking)

    with pytest.raises(AppError) as error:
        instance._update(booking.booking_id, body)

    assert error.value.detail["code"] == "GROUP_BOOKING_REQUIRES_AUTO_ASSIGNMENT"


def test_single_to_group_rejects_manually_selected_therapist():
    booking = SimpleNamespace(
        booking_id=uuid4(),
        booking_date=BOOKING_DATE,
        start_time=START,
        number_of_people=1,
    )
    course_id = uuid4()
    body = BookingPatchInput(
        auto_assign_therapists=True,
        reservations=[
            {
                "person_index": index,
                "therapist_id": uuid4(),
                "courses": [{"course_id": course_id, "course_role": "main"}],
            }
            for index in (1, 2)
        ],
    )
    instance = BookingService.__new__(BookingService)
    instance.booking_repo = SimpleNamespace(find_by_id=lambda value: booking)

    with pytest.raises(AppError) as error:
        instance._update(booking.booking_id, body)

    assert error.value.detail["code"] == "GROUP_BOOKING_CANNOT_SPECIFY_THERAPIST"


def test_auto_assignment_uses_available_therapists_and_excludes_current_booking():
    booking = SimpleNamespace(booking_id=uuid4(), shop_id=SHOP_ID)
    course = SimpleNamespace(
        course_id=uuid4(),
        shop_id=SHOP_ID,
        name="60",
        duration_minutes=60,
        price=100,
        course_type="main",
        is_active=True,
    )
    therapists = [therapist("Auto A"), therapist("Auto B")]
    captured = {}

    def evaluate_availability(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(
            available_therapist_count=2,
            available_therapists=therapists,
        )

    instance = BookingService.__new__(BookingService)
    instance.course_repo = SimpleNamespace(find_by_id=lambda value: course)
    instance.availability_service = SimpleNamespace(evaluate=evaluate_availability)
    items = BookingPatchInput(
        auto_assign_therapists=True,
        reservations=[
            {
                "person_index": index,
                "courses": [{"course_id": course.course_id, "course_role": "main"}],
            }
            for index in (1, 2)
        ],
    ).reservations

    assigned = instance._auto_assign_group_therapists(
        booking, items, BOOKING_DATE, START
    )

    assert set(assigned) == {item.therapist_id for item in therapists}
    assert captured["request_type"] == "none"
    assert captured["exclude_booking_id"] == booking.booking_id


def priority_service(displaced, requested_result, replacement_result):
    instance = BookingService.__new__(BookingService)
    results = iter((requested_result, replacement_result))
    instance.availability_service = SimpleNamespace(
        evaluate=lambda **kwargs: next(results)
    )
    instance.reservation_repo = SimpleNamespace(
        find_overlaps_for_update=lambda *args: [displaced],
        save=lambda value: value,
    )
    instance.session = SimpleNamespace(flush=lambda: None)
    return instance


def availability_result(
    available_therapists=None,
    *,
    covering=1,
    blocked=0,
):
    available_therapists = available_therapists or []
    return SimpleNamespace(
        available_therapists=available_therapists,
        available_therapist_count=len(available_therapists),
        covering_therapist_count=covering,
        blocked_therapist_count=blocked,
    )


def auto_group_reservation(requested_therapist_id):
    booking = SimpleNamespace(
        shop_id=SHOP_ID,
        booking_date=BOOKING_DATE,
        number_of_people=2,
        therapist_request_type="none",
        requested_gender=None,
    )
    return SimpleNamespace(
        therapist_id=requested_therapist_id,
        assignment_source="auto",
        booking=booking,
        start_time=START,
        end_time=END,
    )


def test_specific_request_rebalances_auto_single_reservation():
    requested_id = uuid4()
    replacement = therapist("Single replacement")
    displaced = auto_group_reservation(requested_id)
    displaced.booking.number_of_people = 1
    instance = priority_service(
        displaced,
        availability_result(),
        availability_result([replacement]),
    )

    resolved = instance._resolve_specific_therapist_with_priority(
        SHOP_ID, BOOKING_DATE, START, END, requested_id
    )

    assert resolved == requested_id
    assert displaced.therapist_id == replacement.therapist_id
    assert displaced.assignment_source == "auto"


def test_slot_precheck_reports_auto_single_as_rebalanceable():
    requested_id = uuid4()
    replacement = therapist("Precheck replacement")
    displaced = auto_group_reservation(requested_id)
    displaced.booking.number_of_people = 1
    instance = SlotService.__new__(SlotService)
    instance.reservation_repo = SimpleNamespace(
        find_overlaps=lambda *args: [displaced]
    )
    instance.availability_service = SimpleNamespace(
        evaluate=lambda **kwargs: availability_result([replacement])
    )

    assert instance._can_rebalance_specific_assignment(
        SHOP_ID, BOOKING_DATE, START, END, requested_id, SimpleNamespace()
    ) is True


def test_slot_precheck_never_rebalances_specific_reservation():
    requested_id = uuid4()
    displaced = auto_group_reservation(requested_id)
    displaced.assignment_source = "specific"
    instance = SlotService.__new__(SlotService)
    instance.reservation_repo = SimpleNamespace(
        find_overlaps=lambda *args: [displaced]
    )
    instance.availability_service = SimpleNamespace(
        evaluate=lambda **kwargs: pytest.fail("must not search for a replacement")
    )

    assert instance._can_rebalance_specific_assignment(
        SHOP_ID, BOOKING_DATE, START, END, requested_id, SimpleNamespace()
    ) is False


def test_specific_request_rebalances_auto_group_reservation():
    requested_id = uuid4()
    replacement = therapist("Replacement")
    displaced = auto_group_reservation(requested_id)
    instance = priority_service(
        displaced,
        availability_result(),
        availability_result([replacement]),
    )

    resolved = instance._resolve_specific_therapist_with_priority(
        SHOP_ID, BOOKING_DATE, START, END, requested_id
    )

    assert resolved == requested_id
    assert displaced.therapist_id == replacement.therapist_id
    assert displaced.assignment_source == "auto"


def test_specific_request_does_not_displace_specific_assignment():
    requested_id = uuid4()
    displaced = auto_group_reservation(requested_id)
    displaced.assignment_source = "specific"
    instance = priority_service(
        displaced,
        availability_result(),
        availability_result([therapist("Unused")]),
    )

    with pytest.raises(AppError) as error:
        instance._resolve_specific_therapist_with_priority(
            SHOP_ID, BOOKING_DATE, START, END, requested_id
        )

    assert error.value.detail["code"] == "THERAPIST_NOT_AVAILABLE"
    assert displaced.therapist_id == requested_id


def test_specific_request_fails_without_replacement_and_keeps_group_unchanged():
    requested_id = uuid4()
    displaced = auto_group_reservation(requested_id)
    instance = priority_service(
        displaced,
        availability_result(),
        availability_result(),
    )

    with pytest.raises(AppError) as error:
        instance._resolve_specific_therapist_with_priority(
            SHOP_ID, BOOKING_DATE, START, END, requested_id
        )

    assert error.value.detail["code"] == "NO_REPLACEMENT_THERAPIST_AVAILABLE"
    assert displaced.therapist_id == requested_id


def test_create_rolls_back_priority_failure_without_committing():
    calls = []
    instance = BookingService.__new__(BookingService)
    instance.session = SimpleNamespace(
        commit=lambda: calls.append("commit"),
        rollback=lambda: calls.append("rollback"),
    )

    def fail_create(*args):
        raise AppError(
            409,
            code="NO_REPLACEMENT_THERAPIST_AVAILABLE",
            detail="No replacement",
        )

    instance._create = fail_create

    with pytest.raises(AppError):
        instance.create(SimpleNamespace(), str(uuid4()))

    assert calls == ["rollback"]


def test_overlap_rows_are_locked_and_cancelled_bookings_are_excluded():
    class CapturingScalars:
        def all(self):
            return []

    class CapturingSession:
        statement = None

        def scalars(self, statement):
            self.statement = statement
            return CapturingScalars()

    session = CapturingSession()
    repository = ReservationRepository(session)
    repository.find_overlaps_for_update(
        uuid4(), BOOKING_DATE, START, END
    )

    sql = str(session.statement.compile(compile_kwargs={"literal_binds": True})).lower()
    assert "bookings.status != 'cancelled'" in sql
    assert "for update" in sql
