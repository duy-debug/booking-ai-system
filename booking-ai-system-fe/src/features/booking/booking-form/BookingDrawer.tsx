"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ApiError } from "@/shared/types/api-error";
import type { UUID } from "@/shared/types/common";
import { useAdminBookingDetail, useCancelBooking } from "@/features/booking/use-booking-queries";
import { absoluteMinutesToHHMM } from "../schedule.utils";
import type { BookingViewModel } from "../schedule.types";
import type { Selection } from "../SelectionLayer";
import { BookingForm, type BookingFormHandle } from "./BookingForm";
import type { BookingFormInitial } from "./booking-form.schema";
import { resolveCloseIntent, resolveEscapeIntent } from "./booking-close-flow";

export type BookingDrawerState =
  | { kind: "create"; selection: Selection; shopId: UUID; bookingDate: string }
  | { kind: "edit"; booking: BookingViewModel; shopId: UUID; bookingDate: string }
  | null;

interface BookingDrawerProps {
  state: BookingDrawerState;
  onClose: () => void;
  onSaved: (bookingId: UUID) => void;
}

export function BookingDrawer({ state, onClose, onSaved }: BookingDrawerProps) {
  if (!state) return null;
  return <BookingModalInner state={state} onClose={onClose} onSaved={onSaved} />;
}

// ─── Modal inner ────────────────────────────────────────────────────────
function BookingModalInner({
  state,
  onClose,
  onSaved,
}: {
  state: NonNullable<BookingDrawerState>;
  onClose: () => void;
  onSaved: (bookingId: UUID) => void;
}) {
  const router = useRouter();
  const isEdit = state.kind === "edit";
  const bookingId = isEdit ? state.booking.bookingId : undefined;

  const detailQuery = useAdminBookingDetail(bookingId ?? ("" as UUID), {
    enabled: isEdit,
  });
  const cancelMut = useCancelBooking();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{ available: boolean; message?: string } | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const formRef = useRef<BookingFormHandle>(null);

  // Clear footer state when modal opens fresh
  useEffect(() => { setFormError(null); setAvailability(null); setAvailabilityLoading(false); /* eslint-disable-line react-hooks/set-state-in-effect */ }, [state]);

  const closeBookingForm = useCallback(() => onClose(), [onClose]);

  const requestClose = useCallback(() => {
    if (resolveCloseIntent(dirty) === "close-form") {
      closeBookingForm();
      return;
    }
    setConfirmCloseOpen(true);
  }, [closeBookingForm, dirty]);

  const cancelDiscardChanges = useCallback(() => {
    setConfirmCloseOpen(false);
    setPendingNavigation(null);
  }, []);

  const confirmDiscardChanges = useCallback(() => {
    const navigationTarget = pendingNavigation;
    formRef.current?.reset();
    setDirty(false);
    setConfirmCloseOpen(false);
    setPendingNavigation(null);
    closeBookingForm();
    if (navigationTarget) router.push(navigationTarget);
  }, [closeBookingForm, pendingNavigation, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const intent = resolveEscapeIntent({
        confirmCloseOpen,
        cancelBookingOpen: showCancelConfirm,
        isDirty: dirty,
      });
      if (intent === "close-discard-dialog") {
        cancelDiscardChanges();
      } else if (intent === "close-cancel-dialog") {
        setShowCancelConfirm(false);
      } else if (intent === "close-form") {
        closeBookingForm();
      } else {
        setConfirmCloseOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelDiscardChanges, closeBookingForm, confirmCloseOpen, dirty, showCancelConfirm]);

  useEffect(() => {
    const interceptNavigation = (event: MouseEvent) => {
      if (!dirty || confirmCloseOpen || showCancelConfirm || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(`${url.pathname}${url.search}${url.hash}`);
      setConfirmCloseOpen(true);
    };

    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  }, [confirmCloseOpen, dirty, showCancelConfirm]);

  const initial: BookingFormInitial = useMemo(() => {
    if (state.kind === "create") {
      return {
        mode: "create",
        shopId: state.shopId,
        bookingDate: state.bookingDate,
        startTime: absoluteMinutesToHHMM(state.selection.startMinutes),
        therapistId: state.selection.therapistId as UUID | undefined,
      };
    }
    const d = detailQuery.data;
    return {
      mode: "edit",
      bookingId: state.booking.bookingId,
      shopId: state.shopId,
      bookingDate: state.booking.bookingDate,
      startTime: absoluteMinutesToHHMM(state.booking.startMinutes),
      therapistId: state.booking.therapistId as UUID | undefined,
      customerPhone: d?.customerId ? undefined : state.booking.customerPhone,
      customerName: state.booking.customerName ?? undefined,
    };
  }, [state, detailQuery.data]);

  const handleCancelBooking = async () => {
    if (!bookingId) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelMut.mutateAsync({ id: bookingId, cancelReason: "Huỷ từ admin" });
      setShowCancelConfirm(false);
      onSaved(bookingId);
      onClose();
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.detail || "Huỷ thất bại" : "Huỷ thất bại");
    } finally {
      setCancelling(false);
    }
  };

  const handleSaved = (id: UUID) => {
    setDirty(false);
    onSaved(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={requestClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="relative flex flex-col bg-white shadow-xl outline-none
          w-[96vw] max-w-[1400px] h-[92vh] max-h-[900px] rounded-lg border border-zinc-200"
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-4">
            <h2 id="booking-modal-title" className="text-sm font-bold text-zinc-900">
              {isEdit ? "Chỉnh sửa booking" : "Tạo booking mới"}
            </h2>
            <span className="text-[11px] text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
              {state.shopId.slice(0, 8)}...
            </span>
            <span className="text-[11px] text-zinc-500">
              {state.bookingDate}
            </span>
            {isEdit && (
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                #{state.booking.bookingId.slice(0, 8)}
              </span>
            )}
          </div>
          <button type="button" onClick={requestClose} className="h-7 w-7 flex items-center justify-center rounded hover:bg-zinc-100 text-zinc-500" aria-label="Đóng">
            ✕
          </button>
        </div>

        {/* ═══ Scrollable body ═══ */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isEdit && detailQuery.isLoading && (
            <p className="text-xs text-zinc-400 mb-3">Đang tải chi tiết booking...</p>
          )}
          {isEdit && detailQuery.isError && (
            <p className="text-xs text-amber-600 mb-3">Không tải được chi tiết. Vẫn có thể sửa giờ.</p>
          )}
          <BookingForm
            ref={formRef}
            initial={initial}
            onDirtyChange={setDirty}
            onSaved={handleSaved}
            onAvailability={setAvailability}
            onAvailabilityLoading={setAvailabilityLoading}
            onFormError={setFormError}
          />
        </div>

        {/* ═══ Footer ═══ */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2.5 shrink-0 bg-zinc-50">
          {/* Left: errors + summary + availability */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {formError && (
              <span className="text-[11px] text-red-600 font-medium truncate">{formError}</span>
            )}
            <span className="text-zinc-300">|</span>
            {availabilityLoading ? (
              <span className="text-[11px] text-zinc-400 italic">Đang kiểm tra...</span>
            ) : availability ? (
              availability.available ? (
                <span className="text-[11px] font-medium text-emerald-600">✔ Khả dụng</span>
              ) : (
                <span className="text-[11px] font-medium text-red-600">✖ {availability.message ?? "Trùng lịch"}</span>
              )
            ) : (
              <span className="text-[11px] text-zinc-400 italic">Chưa kiểm tra</span>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={requestClose} disabled={cancelling} className="h-8 text-xs px-3">
              Đóng
            </Button>
            {isEdit && (
              <Button type="button" variant="danger" disabled={cancelling} onClick={() => setShowCancelConfirm(true)} className="h-8 text-xs px-3">
                Huỷ
              </Button>
            )}
            <Button type="submit" form="booking-form" disabled={cancelling} className="h-8 text-xs px-4">
              {isEdit ? "Cập nhật" : "Tạo booking"}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCloseOpen}
        title="Có thay đổi chưa lưu"
        description="Bạn đã chỉnh sửa thông tin booking. Nếu đóng bây giờ, các thay đổi sẽ bị mất."
        cancelLabel="Tiếp tục chỉnh sửa"
        confirmLabel="Đóng không lưu"
        tone="danger"
        onCancel={cancelDiscardChanges}
        onConfirm={confirmDiscardChanges}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title="Hủy booking"
        description={cancelError ?? "Xác nhận hủy booking này? Thao tác không thể hoàn tác."}
        cancelLabel="Không"
        confirmLabel="Hủy booking"
        tone="danger"
        isLoading={cancelling}
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelBooking}
      />
    </div>
  );
}
