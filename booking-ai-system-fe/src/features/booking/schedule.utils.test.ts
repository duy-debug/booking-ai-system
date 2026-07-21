import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  toAbsoluteMinutes,
  timeToX,
  durationToWidth,
  xToMinutes,
  timelineDuration,
  formatAbsoluteHour,
  snapMinutes,
  buildTimelineRange,
  FULL_DAY_RANGE,
} from "./schedule.utils";
import type { TimeRange } from "./schedule.utils";

const RANGE_SAME_DAY: TimeRange = { start: 540, end: 1080 }; // 09:00 - 18:00
const RANGE_OVERNIGHT: TimeRange = { start: 540, end: 1740 }; // 09:00 - 05:00+1

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("09:00")).toBe(540);
    expect(parseTimeToMinutes("01:30")).toBe(90);
  });
  it("parses HH:MM:SS", () => {
    expect(parseTimeToMinutes("13:45:00")).toBe(825);
  });
});

describe("FULL_DAY_RANGE", () => {
  it("start = 0 (00:00)", () => {
    expect(FULL_DAY_RANGE.start).toBe(0);
  });
  it("end = 1440 (24:00)", () => {
    expect(FULL_DAY_RANGE.end).toBe(1440);
  });
  it("totalMinutes = 1440", () => {
    expect(FULL_DAY_RANGE.end - FULL_DAY_RANGE.start).toBe(1440);
  });
});

describe("toAbsoluteMinutes (xử lý qua nửa đêm)", () => {
  it("giữ nguyên khi trong khung cùng ngày", () => {
    expect(toAbsoluteMinutes("09:00", RANGE_SAME_DAY.start)).toBe(540);
    expect(toAbsoluteMinutes("12:00", RANGE_SAME_DAY.start)).toBe(720);
  });
  it("cộng 1440 khi giờ nhỏ hơn start (qua nửa đêm)", () => {
    // 01:00 < 09:00 -> sang ngày hôm sau
    expect(toAbsoluteMinutes("01:00", RANGE_OVERNIGHT.start)).toBe(60 + 1440);
  });
  it("giờ lớn hơn start giữ nguyên", () => {
    expect(toAbsoluteMinutes("22:00", RANGE_OVERNIGHT.start)).toBe(1320);
  });
  it("giờ trên full-day range giữ nguyên", () => {
    expect(toAbsoluteMinutes("09:00", FULL_DAY_RANGE.start)).toBe(540);
    expect(toAbsoluteMinutes("23:30", FULL_DAY_RANGE.start)).toBe(1410);
  });
});

describe("timeToX", () => {
  it("tính vị trí px từ đầu timeline", () => {
    const px = 4;
    expect(timeToX(540, RANGE_SAME_DAY, px)).toBe(0);
    expect(timeToX(600, RANGE_SAME_DAY, px)).toBe((600 - 540) * px);
  });
  it("hỗ trợ giờ qua nửa đêm", () => {
    const px = 4;
    expect(timeToX(1500, RANGE_OVERNIGHT, px)).toBe((1500 - 540) * px);
  });
  it("vị trí chính xác trên full-day range", () => {
    const px = 1;
    // 00:00 = 0 -> 0
    expect(timeToX(0, FULL_DAY_RANGE, px)).toBe(0);
    // 12:00 = 720 -> 720
    expect(timeToX(720, FULL_DAY_RANGE, px)).toBe(720);
    // 18:00 = 1080 -> 1080
    expect(timeToX(1080, FULL_DAY_RANGE, px)).toBe(1080);
    // 23:30 = 1410 -> 1410
    expect(timeToX(1410, FULL_DAY_RANGE, px)).toBe(1410);
    // 24:00 = 1440 -> 1440
    expect(timeToX(1440, FULL_DAY_RANGE, px)).toBe(1440);
  });
});

describe("durationToWidth", () => {
  it("nhân duration với pxPerMinute", () => {
    expect(durationToWidth(60, 4)).toBe(240);
    expect(durationToWidth(15, 4)).toBe(60);
  });
});

describe("xToMinutes (ngược lại timeToX)", () => {
  it("round-trip với timeToX", () => {
    const px = 4;
    const abs = 720;
    const x = timeToX(abs, RANGE_SAME_DAY, px);
    expect(xToMinutes(x, RANGE_SAME_DAY, px)).toBe(abs);
  });
});

describe("timelineDuration", () => {
  it("tính tổng phút", () => {
    expect(timelineDuration(RANGE_SAME_DAY)).toBe(540);
    expect(timelineDuration(RANGE_OVERNIGHT)).toBe(1200);
    expect(timelineDuration(FULL_DAY_RANGE)).toBe(1440);
  });
});

describe("formatAbsoluteHour (format 25:00)", () => {
  it("giờ bình thường", () => {
    expect(formatAbsoluteHour(540)).toBe("09:00");
    expect(formatAbsoluteHour(1080)).toBe("18:00");
  });
  it("giờ qua nửa đêm thành 25:00 khi padDay", () => {
    expect(formatAbsoluteHour(1500, { padDay: true })).toBe("25:00");
    expect(formatAbsoluteHour(1740, { padDay: true })).toBe("29:00");
  });
  it("không padDay thì quay vòng 00:00", () => {
    expect(formatAbsoluteHour(1500)).toBe("01:00");
  });
  it("format 00:00 và 24:00 trên full-day range", () => {
    expect(formatAbsoluteHour(0)).toBe("00:00");
    expect(formatAbsoluteHour(1440)).toBe("00:00"); // 24:00 = 00:00 wrap
  });
});

describe("snapMinutes", () => {
  it("snap về bước gần nhất", () => {
    expect(snapMinutes(547, 15)).toBe(540);
    expect(snapMinutes(548, 15)).toBe(555);
    expect(snapMinutes(59, 5)).toBe(60);
  });
});

describe("buildTimelineRange (business hours qua nửa đêm)", () => {
  it("cùng ngày", () => {
    expect(buildTimelineRange("09:00", "18:00")).toEqual({ start: 540, end: 1080 });
  });
  it("qua nửa đêm: 09:00 -> 05:00 hôm sau = 1740", () => {
    expect(buildTimelineRange("09:00", "05:00")).toEqual({ start: 540, end: 1740 });
  });
});
