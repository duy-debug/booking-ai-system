"use client";

import { useRef, useCallback, memo } from "react";
import type { TimeRange } from "./schedule.utils";
import { xToMinutes, createDefaultSelection } from "./schedule.utils";
import { ROW_HEIGHT, type TimeStep } from "./schedule.theme";
import { ResourceColumn } from "./ResourceColumn";
import { ShiftLayer } from "./ShiftLayer";
import { BookingLayer } from "./BookingLayer";
import { SelectionLayer, type Selection } from "./SelectionLayer";
import { TimeGrid } from "./TimeGrid";
import type { BookingViewModel, ResourceViewModel } from "./schedule.types";

interface ResourceRowProps {
  resource: ResourceViewModel;
  bookings: BookingViewModel[];
  range: TimeRange;
  step: TimeStep;
  pxPerMinute: number;
  selection: Selection | null;
  onSelectBooking: (b: BookingViewModel) => void;
  onStartSelection: (sel: Selection) => void;
  onCommitSelection: (sel: Selection) => void;
  onClearSelection: () => void;
  earliestSelectableMinutes: number | null;
  onInvalidSelection: () => void;
}

const ResourceRowInner = memo(function ResourceRowInner({
  resource,
  bookings,
  range,
  step,
  pxPerMinute,
  selection,
  onSelectBooking,
  onStartSelection,
  onCommitSelection,
  onClearSelection,
  earliestSelectableMinutes,
  onInvalidSelection,
}: ResourceRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const totalWidth = (range.end - range.start) * pxPerMinute;

  const hasActiveShift = resource.shifts.some((s) => s.isActive);
  const hasAnyShift = resource.shifts.length > 0;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedMinutes = xToMinutes(x, range, pxPerMinute);

    if (
      earliestSelectableMinutes !== null &&
      clickedMinutes < earliestSelectableMinutes
    ) {
      onInvalidSelection();
      return;
    }

    // Only create selection if clicked within an active shift
    const inActiveShift = resource.shifts.some(
      (s) => s.isActive && clickedMinutes >= s.startMinutes && clickedMinutes < s.endMinutes,
    );
    if (!inActiveShift) return;

    // Don't create selection over an existing booking
    const overBooking = bookings.some(
      (b) => clickedMinutes >= b.startMinutes && clickedMinutes < b.endMinutes,
    );
    if (overBooking) return;

    const sel = createDefaultSelection(clickedMinutes, step, range.end, resource.therapistId);
    onStartSelection(sel);
  }, [range, step, pxPerMinute, resource.therapistId, onStartSelection, resource.shifts, bookings, earliestSelectableMinutes, onInvalidSelection]);

  const rowSelection = selection?.therapistId === resource.therapistId ? selection : null;

  return (
    <div className="flex border-b border-zinc-100" style={{ height: ROW_HEIGHT }}>
      <ResourceColumn name={resource.name} hasActiveShift={hasActiveShift} hasAnyShift={hasAnyShift} />
      <div
        ref={trackRef}
        className="relative cursor-pointer bg-white"
        style={{ width: totalWidth }}
        onClick={handleClick}
        title={earliestSelectableMinutes === Number.POSITIVE_INFINITY ? "Không thể tạo booking cho ngày trong quá khứ" : undefined}
      >
        <TimeGrid range={range} height={ROW_HEIGHT} pxPerMinute={pxPerMinute} step={step} />
        <ShiftLayer shifts={resource.shifts} range={range} pxPerMinute={pxPerMinute} />
        {earliestSelectableMinutes !== null && earliestSelectableMinutes > range.start && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 border-r border-red-200 bg-zinc-400/20"
            style={{
              width: Math.min(
                totalWidth,
                (earliestSelectableMinutes - range.start) * pxPerMinute,
              ),
            }}
            aria-hidden="true"
          />
        )}
        <BookingLayer bookings={bookings} range={range} pxPerMinute={pxPerMinute} onSelect={onSelectBooking} />
        <SelectionLayer
          selection={rowSelection}
          range={range}
          pxPerMinute={pxPerMinute}
          onCommit={onCommitSelection}
          onClear={onClearSelection}
        />
      </div>
    </div>
  );
});

export { ResourceRowInner as ResourceRow };
