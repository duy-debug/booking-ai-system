import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/hooks/api", () => ({
  apiClient: { patch: vi.fn() },
  useApiListQuery: vi.fn(),
  useApiMutation: vi.fn(),
  useApiQuery: vi.fn(),
}));

import { apiClient } from "@/shared/hooks/api";
import { bookingApi } from "./booking.types";
import { cancelBooking } from "./use-booking-queries";

describe("cancelBooking", () => {
  beforeEach(() => {
    vi.mocked(apiClient.patch).mockReset();
  });

  it("uses the existing public PATCH endpoint with the cancel payload", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      booking_id: "booking-id",
      status: "cancelled",
    });

    await expect(
      cancelBooking({ id: "booking-id", cancelReason: "Hủy từ admin" }),
    ).resolves.toEqual({ booking_id: "booking-id", status: "cancelled" });

    expect(apiClient.patch).toHaveBeenCalledWith("/api/bookings/booking-id", {
      status: "cancelled",
      cancel_reason: "Hủy từ admin",
    });
  });

  it("does not point cancellation at the read-only admin detail route", () => {
    expect(bookingApi.cancel("booking-id")).toBe("/api/bookings/booking-id");
    expect(bookingApi.cancel("booking-id")).not.toContain("/api/admin/bookings");
  });
});
