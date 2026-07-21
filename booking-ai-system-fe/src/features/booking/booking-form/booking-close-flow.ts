export type CloseIntent = "close-form" | "open-discard-dialog";

export function resolveCloseIntent(isDirty: boolean): CloseIntent {
  return isDirty ? "open-discard-dialog" : "close-form";
}

export type EscapeIntent =
  | "close-discard-dialog"
  | "close-cancel-dialog"
  | CloseIntent;

export function resolveEscapeIntent(input: {
  confirmCloseOpen: boolean;
  cancelBookingOpen: boolean;
  isDirty: boolean;
}): EscapeIntent {
  if (input.confirmCloseOpen) return "close-discard-dialog";
  if (input.cancelBookingOpen) return "close-cancel-dialog";
  return resolveCloseIntent(input.isDirty);
}
