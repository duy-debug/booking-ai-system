import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders an accessible in-app alert dialog with the safe action first", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        title: "Có thay đổi chưa lưu",
        description: "Nội dung đã chỉnh sửa sẽ bị mất.",
        cancelLabel: "Tiếp tục chỉnh sửa",
        confirmLabel: "Đóng không lưu",
        tone: "danger",
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );

    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("aria-describedby=");
    expect(html.indexOf("Tiếp tục chỉnh sửa")).toBeLessThan(
      html.indexOf("Đóng không lưu"),
    );
  });

  it("renders nothing while closed", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: false,
        title: "Confirm",
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      }),
    );
    expect(html).toBe("");
  });
});
