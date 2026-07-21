"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ScheduleHeader } from "./ScheduleHeader";
import { ResourceRow } from "./ResourceRow";
import { CurrentTimeLine } from "./CurrentTimeLine";
import { type Selection } from "./SelectionLayer";
import type { BookingViewModel, ScheduleViewModel } from "./schedule.types";
import type { TimeStep } from "./schedule.theme";
import {
  RESOURCE_COLUMN_WIDTH,
} from "./schedule.theme";
import {
  calculatePixelsPerMinute,
  FIT_BREAKPOINT,
  MOBILE_PX_PER_MINUTE,
} from "./schedule.utils";
import { SHOP_TIMEZONE } from "@/shared/config/shop";
import { todayShopDate } from "@/shared/lib/datetime";

interface ScheduleBoardProps {
  schedule: ScheduleViewModel | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error;
  step: TimeStep;
  onSelectBooking: (b: BookingViewModel) => void;
  onCreateBooking: (selection: Selection) => void;
}

export function ScheduleBoard({
  schedule,
  isLoading,
  isError,
  error,
  step,
  onSelectBooking,
  onCreateBooking,
}: ScheduleBoardProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(0);

  // Clear selection when step or date changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelection(null);
  }, [step, schedule?.date]);

  // ResizeObserver on the board container (entire width)
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBoardWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleClearSelection = useCallback(() => setSelection(null), []);
  const handleStartSelection = useCallback((sel: Selection) => setSelection(sel), []);
  const handleCommitSelection = useCallback((sel: Selection) => {
    onCreateBooking(sel);
    setSelection(null);
  }, [onCreateBooking]);

  const bookingsByTherapist = useMemo(() => {
    if (!schedule) return new Map<string, BookingViewModel[]>();
    const map = new Map<string, BookingViewModel[]>();
    for (const b of schedule.bookings) {
      const arr = map.get(b.therapistId);
      if (arr) arr.push(b);
      else map.set(b.therapistId, [b]);
    }
    return map;
  }, [schedule]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
        Đang tải lịch...
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex h-full items-center justify-center text-red-500 text-sm">
        Lỗi: {error?.message ?? "Không xác định"}
      </div>
    );
  }
  if (!schedule || schedule.resources.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
        Không có therapist/ca nào cho ngày này.
      </div>
    );
  }

  const range = {
    start: schedule.timelineStartMinutes,
    end: schedule.timelineEndMinutes,
  };
  const totalMinutes = range.end - range.start;

  // Available width for timeline = board width minus therapist column
  const availableWidth = Math.max(0, boardWidth - RESOURCE_COLUMN_WIDTH);
  const isDesktop = boardWidth >= FIT_BREAKPOINT;

  // Desktop: fit exactly (availableWidth / totalMinutes) → no overflow
  // Mobile: fixed minimum PPM → overflow-x-auto
  const pxPerMinute = availableWidth > 0
    ? isDesktop
      ? calculatePixelsPerMinute(availableWidth, totalMinutes)
      : MOBILE_PX_PER_MINUTE
    : 1.0;

  const isToday = schedule.date === todayShopDate();

  return (
    <div
      ref={boardRef}
      className={`h-full border border-zinc-200 rounded-lg bg-white ${isDesktop ? "overflow-hidden" : "overflow-auto"}`}
    >
      <ScheduleHeader range={range} pxPerMinute={pxPerMinute} />
      {/* Each ResourceRow has its own ResourceColumn + timeline */}
      <div className="relative">
        {schedule.resources.map((res) => (
          <ResourceRow
            key={res.therapistId}
            resource={res}
            bookings={bookingsByTherapist.get(res.therapistId) ?? []}
            range={range}
            step={step}
            pxPerMinute={pxPerMinute}
            selection={selection}
            onSelectBooking={onSelectBooking}
            onStartSelection={handleStartSelection}
            onCommitSelection={handleCommitSelection}
            onClearSelection={handleClearSelection}
          />
        ))}
        {isToday && (
          <CurrentTimeLine
            range={range}
            date={schedule.date}
            timezone={SHOP_TIMEZONE}
            pxPerMinute={pxPerMinute}
          />
        )}
      </div>
    </div>
  );
}
