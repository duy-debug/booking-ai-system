// Tách riêng toàn bộ logic thời gian <-> vị trí pixel và xử lý qua nửa đêm.
// Không tính timezone rải rác trong component (nguyên tắc 6).
// Backend lưu time là giá trị NAIVE (không múi giờ) — xem docs/frontend-analysis.md §6.7, §9.

export const MINUTES_PER_DAY = 1440;

// Full-day timeline: 00:00 – 24:00 (1440 phút)
export const FULL_DAY_RANGE: TimeRange = { start: 0, end: MINUTES_PER_DAY };

export interface TimeRange {
  // Phút tuyệt đối của đầu timeline (vd 09:00 = 540, 00:00 = 0)
  start: number;
  // Phút tuyệt đối của cuối timeline (vd 05:00 hôm sau = 300 + 1440 = 1740, 24:00 = 1440)
  end: number;
}

// "HH:MM" hoặc "HH:MM:SS" -> số phút từ 00:00 (0..1439)
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Chuyển giờ thành phút tuyệt đối trên timeline, xử lý qua nửa đêm.
// Nếu giờ < start (vd 01:00 khi start=09:00) => coi là sang ngày hôm sau (+1440).
export function toAbsoluteMinutes(
  time: string,
  timelineStart: number,
): number {
  let mins = parseTimeToMinutes(time);
  if (mins < timelineStart && timelineStart >= 0) {
    mins += MINUTES_PER_DAY;
  }
  return mins;
}

// Helper: tính absolute minutes cho end_time của item có spans_midnight=true.
// Trên full-day range (start=0), parseTimeToMinutes giữ nguyên, cần +1440.
export function toOvernightEndMinutes(time: string): number {
  return parseTimeToMinutes(time) + MINUTES_PER_DAY;
}

// Phút tuyệt đối trên timeline -> "HH:MM" (naive, giờ đồng hồ).
// Dùng để prefill giờ bắt đầu khi user click một ô trống / booking.
export function absoluteMinutesToHHMM(absMinutes: number): string {
  const m = ((absMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Tổng số phút của timeline (có thể > 1440 nếu qua nửa đêm)
export function timelineDuration(range: TimeRange): number {
  return range.end - range.start;
}

// Vị trí X (px) của một giờ tuyệt đối so với đầu timeline
export function timeToX(
  absoluteMinutes: number,
  range: TimeRange,
  pxPerMinute: number,
): number {
  return (absoluteMinutes - range.start) * pxPerMinute;
}

// Ngược lại: từ X (px) sang phút tuyệt đối
export function xToMinutes(x: number, range: TimeRange, pxPerMinute: number): number {
  return range.start + x / pxPerMinute;
}

// Độ rộng (px) của một khoảng thời lượng
export function durationToWidth(durationMinutes: number, pxPerMinute: number): number {
  return durationMinutes * pxPerMinute;
}

// Format nhãn giờ. Khi qua nửa đêm, 01:00 -> "25:00" (absoluteMinutes >= 1440).
// Trả về "HH:MM".
export function formatAbsoluteHour(absoluteMinutes: number, opts?: { padDay?: boolean }): string {
  const m = ((absoluteMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  // Nếu absolute >= 1440 và padDay -> hiển thị giờ + 24
  if (opts?.padDay && absoluteMinutes >= MINUTES_PER_DAY) {
    const hDay = h + 24;
    return `${String(hDay).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Sinh danh sách nhãn giờ theo step (phút) cho header
export function buildHourTicks(
  range: TimeRange,
  stepMinutes: number,
  opts?: { padDay?: boolean },
): Array<{ absoluteMinutes: number; label: string; x: number; pxPerMinute: number }> {
  const pxPerMinute = stepMinutes; // placeholder; thực tế pxPerMinute tính riêng
  const ticks: Array<{ absoluteMinutes: number; label: string; x: number; pxPerMinute: number }> = [];
  for (let t = range.start; t <= range.end; t += stepMinutes) {
    ticks.push({
      absoluteMinutes: t,
      label: formatAbsoluteHour(t, opts),
      x: (t - range.start) * 1, // caller sẽ nhân pxPerMinute
      pxPerMinute,
    });
  }
  return ticks;
}

// Snap một phút tuyệt đối vào bước chia (vd 15 phút)
export function snapMinutes(absoluteMinutes: number, stepMinutes: number): number {
  return Math.round(absoluteMinutes / stepMinutes) * stepMinutes;
}

// Floor xuống step gần nhất
export function floorToStep(absoluteMinutes: number, stepMinutes: number): number {
  return Math.floor(absoluteMinutes / stepMinutes) * stepMinutes;
}

// Ceil lên step gần nhất
export function ceilToStep(absoluteMinutes: number, stepMinutes: number): number {
  return Math.ceil(absoluteMinutes / stepMinutes) * stepMinutes;
}

// Tạo selection mặc định khi click đơn (start = floor, duration = step)
export function createDefaultSelection(
  clickedMinutes: number,
  stepMinutes: number,
  rangeEnd: number,
  therapistId?: string,
): { startMinutes: number; endMinutes: number; therapistId?: string } {
  const start = floorToStep(clickedMinutes, stepMinutes);
  const end = Math.min(start + stepMinutes, rangeEnd);
  return { startMinutes: start, endMinutes: end, therapistId };
}

// Chuẩn hoá selection khi drag (floor start, ceil end, min = step)
export function normalizeDraggedSelection(
  rawStart: number,
  rawEnd: number,
  stepMinutes: number,
  rangeEnd: number,
  therapistId?: string,
): { startMinutes: number; endMinutes: number; therapistId?: string } {
  const snappedStart = floorToStep(Math.min(rawStart, rawEnd), stepMinutes);
  let snappedEnd = ceilToStep(Math.max(rawStart, rawEnd), stepMinutes);
  if (snappedEnd <= snappedStart) {
    snappedEnd = snappedStart + stepMinutes;
  }
  return {
    startMinutes: snappedStart,
    endMinutes: Math.min(snappedEnd, rangeEnd),
    therapistId,
  };
}

// Tính khoảng thời gian hiện tại (phút tuyệt đối) từ Date thực tế theo múi giờ shop.
// Dùng cho CurrentTimeLine. Cần shop timezone.
export function nowAbsoluteMinutes(
  range: TimeRange,
  dateStr: string,
  timezone: string,
): number | null {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const mins = parseTimeToMinutes(timeStr);
  // Với full-day range (start=0, end=1440): mọi giờ 00:00-23:59 đều nằm trong khung
  if (mins < range.start || mins > range.end) return null; // ngoài khung
  return mins;
}

// Tính khoảng timeline từ business hours, hỗ trợ qua nửa đêm.
// Ví dụ open=09:00, close=05:00 -> start=540, end=300+1440=1740.
export function buildTimelineRange(
  open: string,
  close: string,
): TimeRange {
  const start = parseTimeToMinutes(open);
  let end = parseTimeToMinutes(close);
  if (end <= start) end += MINUTES_PER_DAY; // qua nửa đêm
  return { start, end };
}

// Tính pixels-per-minute để fit timeline vừa viewport.
export function calculatePixelsPerMinute(
  viewportWidth: number,
  totalMinutes: number,
): number {
  if (totalMinutes <= 0 || viewportWidth <= 0) return 1.0;
  return viewportWidth / totalMinutes;
}

// Desktop breakpoint: >= 1024px → fit 24h, overflow hidden
export const FIT_BREAKPOINT = 1024;
// Mobile fallback PPM khi viewport < breakpoint
export const MOBILE_PX_PER_MINUTE = 0.65;

// Clamp helper
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

