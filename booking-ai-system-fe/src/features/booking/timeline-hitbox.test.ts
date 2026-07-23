import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Đọc source của component timeline để bảo vệ các class ảnh hưởng trực tiếp tới hitbox khi flex co giãn.
function readBookingSource(fileName: string): string {
  return readFileSync(
    join(process.cwd(), "src/features/booking", fileName),
    "utf8",
  );
}

// Bảo đảm track nhận click và trục giờ không bị flex thu nhỏ lệch khỏi chiều rộng timeline đã tính.
describe("timeline hitbox", () => {
  it("không co chiều rộng vùng nhận click của resource row", () => {
    const source = readBookingSource("ResourceRow.tsx");

    expect(source).toContain('className="relative shrink-0 cursor-pointer bg-white"');
  });

  it("không co chiều rộng trục giờ của schedule header", () => {
    const source = readBookingSource("ScheduleHeader.tsx");

    expect(source).toContain('className="relative shrink-0"');
  });
});
