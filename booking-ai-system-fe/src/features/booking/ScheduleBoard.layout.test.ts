import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Bảo vệ quy tắc timeline desktop vẫn cuộn dọc sau khi ResizeObserver chuyển sang chế độ fit chiều ngang.
describe("ScheduleBoard layout", () => {
  it("không khóa cuộn dọc ở chế độ desktop", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/booking/ScheduleBoard.tsx"),
      "utf8",
    );

    expect(source).toContain('"overflow-x-hidden overflow-y-auto"');
    expect(source).not.toContain('isDesktop ? "overflow-hidden"');
  });
});
