import { describe, expect, it } from "vitest";
import { resolveCloseIntent, resolveEscapeIntent } from "./booking-close-flow";

type FormHarness = {
  open: boolean;
  dirty: boolean;
  confirmOpen: boolean;
  value: string;
};

function requestClose(state: FormHarness): FormHarness {
  if (resolveCloseIntent(state.dirty) === "close-form") {
    return { ...state, open: false };
  }
  return { ...state, confirmOpen: true };
}

function cancelDiscard(state: FormHarness): FormHarness {
  return { ...state, confirmOpen: false };
}

function confirmDiscard(state: FormHarness): FormHarness {
  return { ...state, open: false, dirty: false, confirmOpen: false, value: "" };
}

function closeAfterSave(state: FormHarness): FormHarness {
  return { ...state, open: false, dirty: false, confirmOpen: false };
}

const dirtyForm: FormHarness = {
  open: true,
  dirty: true,
  confirmOpen: false,
  value: "Khách đã chỉnh sửa",
};

describe("booking close flow", () => {
  it("closes immediately when the form is not dirty", () => {
    const result = requestClose({ ...dirtyForm, dirty: false });
    expect(result.open).toBe(false);
    expect(result.confirmOpen).toBe(false);
  });

  it("opens the discard dialog without closing a dirty form", () => {
    const result = requestClose(dirtyForm);
    expect(result.open).toBe(true);
    expect(result.confirmOpen).toBe(true);
  });

  it("keeps the form and draft intact when discard is cancelled", () => {
    const result = cancelDiscard({ ...dirtyForm, confirmOpen: true });
    expect(result.open).toBe(true);
    expect(result.dirty).toBe(true);
    expect(result.value).toBe("Khách đã chỉnh sửa");
  });

  it("resets the draft and closes after discard is confirmed", () => {
    const result = confirmDiscard({ ...dirtyForm, confirmOpen: true });
    expect(result).toEqual({
      open: false,
      dirty: false,
      confirmOpen: false,
      value: "",
    });
  });

  it("closes through the success path without an unsaved dialog", () => {
    const result = closeAfterSave(dirtyForm);
    expect(result.open).toBe(false);
    expect(result.dirty).toBe(false);
    expect(result.confirmOpen).toBe(false);
  });

  it("Escape closes only the discard dialog when it is open", () => {
    expect(
      resolveEscapeIntent({
        confirmCloseOpen: true,
        cancelBookingOpen: false,
        isDirty: true,
      }),
    ).toBe("close-discard-dialog");
  });

  it("Escape requests confirmation for a dirty form", () => {
    expect(
      resolveEscapeIntent({
        confirmCloseOpen: false,
        cancelBookingOpen: false,
        isDirty: true,
      }),
    ).toBe("open-discard-dialog");
  });
});
