from datetime import date, datetime, time, timezone

import pytest

from app.core.exceptions import AppError
from app.services.booking_time import (
    booking_start_window,
    is_booking_start_allowed,
    resolve_shop_timezone,
    validate_booking_start,
)


NOW = datetime(2026, 7, 21, 2, 0, tzinfo=timezone.utc)


def test_vietnam_timezone_is_available_without_system_tzdata(monkeypatch):
    def missing_zoneinfo(_timezone_name: str):
        raise __import__("zoneinfo").ZoneInfoNotFoundError

    monkeypatch.setattr("app.services.booking_time.ZoneInfo", missing_zoneinfo)

    vietnam_timezone = resolve_shop_timezone("Asia/Ho_Chi_Minh")

    assert vietnam_timezone.utcoffset(None).total_seconds() == 7 * 60 * 60


@pytest.mark.parametrize(
    ("start_time", "expected_code"),
    [
        (time(1, 59), "BOOKING_START_IN_PAST"),
        (time(2, 0), "BOOKING_START_TOO_SOON"),
        (time(2, 14), "BOOKING_START_TOO_SOON"),
    ],
)
def test_rejects_past_and_too_soon_times(start_time: time, expected_code: str):
    with pytest.raises(AppError) as exc:
        validate_booking_start(
            date(2026, 7, 21),
            start_time,
            now=NOW,
            timezone_name="UTC",
            advance_minutes=15,
        )
    assert exc.value.detail["code"] == expected_code


@pytest.mark.parametrize("start_time", [time(2, 15), time(2, 16)])
def test_allows_exactly_fifteen_minutes_and_later(start_time: time):
    window = validate_booking_start(
        date(2026, 7, 21),
        start_time,
        now=NOW,
        timezone_name="UTC",
        advance_minutes=15,
    )
    assert window.start_at >= window.earliest_allowed_at


def test_allows_future_date():
    validate_booking_start(
        date(2026, 7, 22),
        time(0, 0),
        now=NOW,
        timezone_name="UTC",
        advance_minutes=15,
    )


def test_availability_uses_the_same_minimum_start_rule():
    assert not is_booking_start_allowed(
        date(2026, 7, 21),
        time(2, 14),
        now=NOW,
        timezone_name="UTC",
        advance_minutes=15,
    )
    assert is_booking_start_allowed(
        date(2026, 7, 21),
        time(2, 15),
        now=NOW,
        timezone_name="UTC",
        advance_minutes=15,
    )


def test_uses_shop_timezone_instead_of_server_timezone():
    # 02:00 UTC is 11:00 in Tokyo. A local 11:14 booking is too soon, not future by 9 hours.
    with pytest.raises(AppError) as exc:
        validate_booking_start(
            date(2026, 7, 21),
            time(11, 14),
            now=NOW,
            timezone_name="Asia/Tokyo",
            advance_minutes=15,
        )
    assert exc.value.detail["code"] == "BOOKING_START_TOO_SOON"


def test_rejects_naive_now():
    with pytest.raises(ValueError, match="timezone-aware"):
        booking_start_window(
            date(2026, 7, 21),
            time(2, 15),
            now=datetime(2026, 7, 21, 2, 0),
            timezone_name="UTC",
        )


def test_slot_can_expire_while_booking_form_is_open():
    booking_date = date(2026, 7, 21)
    start_time = time(2, 15)
    validate_booking_start(
        booking_date,
        start_time,
        now=datetime(2026, 7, 21, 1, 59, tzinfo=timezone.utc),
        timezone_name="UTC",
        advance_minutes=15,
    )

    with pytest.raises(AppError) as exc:
        validate_booking_start(
            booking_date,
            start_time,
            now=datetime(2026, 7, 21, 2, 1, tzinfo=timezone.utc),
            timezone_name="UTC",
            advance_minutes=15,
        )
    assert exc.value.detail["code"] == "BOOKING_START_TOO_SOON"
