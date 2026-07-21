"use client";

import { useApiListQuery, useApiMutation, useApiQuery, apiClient } from "@/shared/hooks/api";
import type { BookingStatus, UUID } from "@/shared/types/common";
import {
  bookingApi,
  toBookingListUi,
  type AdminBookingListItemRaw,
  type BookingListUi,
} from "./booking.types";
import type { AdminBookingDetailRaw } from "./schedule.types";

export interface BookingListQuery {
  shopId?: UUID;
  bookingDate?: string;
  status?: string;
  phone?: string;
  posBookingCode?: string;
  limit?: number;
  cursor?: string | null;
}

export function useAdminBookings(query: BookingListQuery) {
  return useApiListQuery<AdminBookingListItemRaw, BookingListUi>(
    ["admin-bookings", query],
    bookingApi.list,
    {
      shop_id: query.shopId,
      booking_date: query.bookingDate,
      status: query.status,
      phone: query.phone,
      pos_booking_code: query.posBookingCode,
      limit: query.limit ?? 20,
      cursor: query.cursor,
    },
    toBookingListUi,
  );
}

export function useAdminBookingDetail(
  id: UUID,
  options?: { enabled?: boolean },
) {
  return useApiQuery<AdminBookingDetailRaw>(
    ["admin-booking", id],
    bookingApi.detail(id),
    {
      enabled: options?.enabled,
    },
  );
}

export interface CancelBookingVars {
  id: UUID;
  cancelReason?: string;
}

export interface CancelBookingResponse {
  booking_id: UUID;
  status: BookingStatus;
}

export function cancelBooking({ id, cancelReason }: CancelBookingVars) {
  return apiClient.patch<CancelBookingResponse>(bookingApi.cancel(id), {
    status: "cancelled",
    cancel_reason: cancelReason,
  });
}

export function useCancelBooking() {
  return useApiMutation<CancelBookingVars, CancelBookingResponse>(cancelBooking);
}
