"use client";

import { useApiMutation, apiClient } from "@/shared/hooks/api";
import { cryptoRandomUuid } from "@/shared/lib/uuid";
import type { UUID } from "@/shared/types/common";
import type { BookingDetailRaw } from "@/features/booking/booking.types";
import type {
  CreateBookingPayload,
  UpdateBookingPayload,
} from "./booking-form.schema";

// Tạo booking: POST /api/bookings, BẮT BUỘC header Idempotency-Key.
// Backend dùng header này để chặn double-submit (app/services/booking_service.py:176).
// Căn cứ: docs/frontend-analysis.md §3.7, §6.5.
export function useCreateBooking() {
  return useApiMutation<CreateBookingPayload, BookingDetailRaw>((payload) => {
    const idempotencyKey = cryptoRandomUuid();
    return apiClient.postWithHeaders<BookingDetailRaw>(
      "/api/bookings",
      payload,
      { "Idempotency-Key": idempotencyKey },
    );
  });
}

// Sửa booking từ màn hình quản trị qua endpoint admin được bảo vệ bằng Bearer token.
// Căn cứ: docs/frontend-analysis.md §3.7 (allowed_fields).
export function useUpdateBooking(id: UUID) {
  return useApiMutation<UpdateBookingPayload, BookingDetailRaw>((payload) =>
    apiClient.patch<BookingDetailRaw>(`/api/admin/bookings/${id}`, payload),
  );
}
