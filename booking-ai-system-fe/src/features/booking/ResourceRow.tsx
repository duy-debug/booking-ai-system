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
  }, [range, step, pxPerMinute, resource.therapistId, onStartSelection, resource.shifts, bookings]);

  const rowSelection = selection?.therapistId === resource.therapistId ? selection : null;

  return (
    <div className="flex border-b border-zinc-100" style={{ height: ROW_HEIGHT }}>
      <ResourceColumn name={resource.name} hasActiveShift={hasActiveShift} hasAnyShift={hasAnyShift} />
      <div
        ref={trackRef}
        className="relative cursor-pointer bg-white"
        style={{ width: totalWidth }}
        onClick={handleClick}
      >
        <TimeGrid range={range} height={ROW_HEIGHT} pxPerMinute={pxPerMinute} step={step} />
        <ShiftLayer shifts={resource.shifts} range={range} pxPerMinute={pxPerMinute} />
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
