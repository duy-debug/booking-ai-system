"use client";

import { useEffect, useRef } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useCheckEligibility } from "@/features/customer/use-customer-queries";
import {
  checkAvailableSlots,
  type EligibilityResult,
} from "./booking-form.queries";
import type { UUID } from "@/shared/types/common";
import type { AvailabilityState } from "./BookingForm";
import type { BookingFormValues } from "./booking-form.schema";
import { parseTimeToMinutes } from "../schedule.utils";
import { validateBookingStart } from "../booking-time";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Component con tách biệt các effect kiểm tra live (eligibility + availability)
// khỏi form root. Dùng useWatch riêng -> chỉ component này re-render khi field
// thay đổi, không kéo toàn bộ 10 section form re-render (nguyên tắc hiệu năng).
export function BookingLiveChecks({
  form,
  shopId,
  submitting,
  onEligibility,
  onAvailability,
  onAvailabilityLoading,
  refreshToken = 0,
  timezone,
  minimumBookingAdvanceMinutes,
}: {
  form: UseFormReturn<BookingFormValues>;
  shopId: UUID;
  submitting: boolean;
  onEligibility: (r: EligibilityResult | null) => void;
  onAvailability: (a: AvailabilityState | null) => void;
  onAvailabilityLoading: (loading: boolean) => void;
  refreshToken?: number;
  timezone: string;
  minimumBookingAdvanceMinutes: number;
}) {
  const phone = useWatch({ control: form.control, name: "customerPhone" });
  const mainCourseId = useWatch({ control: form.control, name: "mainCourseId" });
  const bookingDate = useWatch({ control: form.control, name: "bookingDate" });
  const startTime = useWatch({ control: form.control, name: "startTime" });
  const numberOfPeople = useWatch({ control: form.control, name: "numberOfPeople" });
  const addonCourseIds = useWatch({ control: form.control, name: "addonCourseIds" });
  const therapistRequestType = useWatch({ control: form.control, name: "therapistRequestType" });
  const requestedTherapistId = useWatch({ control: form.control, name: "requestedTherapistId" });
  const requestedGender = useWatch({ control: form.control, name: "requestedGender" });

  const { mutateAsync: checkEligibility } = useCheckEligibility();
  const checkEligibilityRef = useRef(checkEligibility);
  const eligibilityReqId = useRef(0);
  const eligibilityPhone = useRef<string | null>(null);
  const availabilityReqId = useRef(0);

  useEffect(() => {
    checkEligibilityRef.current = checkEligibility;
  }, [checkEligibility]);

  // Debounce 400ms eligibility check khi SĐT thay đổi
  useEffect(() => {
    const reqId = ++eligibilityReqId.current;
    if (!phone || !/^\+?\d{6,15}$/.test(phone)) {
      if (eligibilityPhone.current !== null) {
        eligibilityPhone.current = null;
        onEligibility(null);
      }
      return;
    }
    eligibilityPhone.current = phone;
    const t = setTimeout(async () => {
      try {
        const result = await checkEligibilityRef.current({ phone, shop_id: shopId });
        if (reqId === eligibilityReqId.current && eligibilityPhone.current === phone) {
          onEligibility(result);
        }
      } catch {
        if (reqId === eligibilityReqId.current && eligibilityPhone.current === phone) {
          onEligibility(null);
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phone, shopId, onEligibility]);

  // Debounce 400ms availability check (backend source of truth), abort stale.
  useEffect(() => {
    if (
      !mainCourseId ||
      !bookingDate ||
      !startTime ||
      !TIME_RE.test(startTime) ||
      numberOfPeople < 1 ||
      numberOfPeople > 3
    ) {
      onAvailability(null);
      return;
    }
    const startValidation = validateBookingStart({
      bookingDate,
      startMinutes: parseTimeToMinutes(startTime),
      timeZone: timezone,
      advanceMinutes: minimumBookingAdvanceMinutes,
    });
    if (!startValidation.valid) {
      onAvailability({ available: false, message: startValidation.message });
      onAvailabilityLoading(false);
      return;
    }
    if (submitting) return;
    const reqId = ++availabilityReqId.current;
    const t = setTimeout(async () => {
      onAvailabilityLoading(true);
      try {
        const slots = await checkAvailableSlots({
          shopId,
          bookingDate,
          numberOfPeople,
          mainCourseId: mainCourseId as UUID,
          addonCourseIds: (addonCourseIds as UUID[]) ?? [],
          therapistRequestType,
          therapistId: requestedTherapistId ? (requestedTherapistId as UUID) : undefined,
          therapistGender: requestedGender,
        });
        if (reqId !== availabilityReqId.current) return;
        const match = slots.find((s) => s.start_time.startsWith(startTime));
        if (!match) {
          onAvailability({ available: false, message: "Ngoài khung giờ" });
        } else if (!match.available) {
          onAvailability({ available: false, message: "Đã có booking khác" });
        } else {
          onAvailability({ available: true });
        }
      } catch {
        if (reqId !== availabilityReqId.current) return;
        onAvailability({ available: false, message: "Lỗi kiểm tra lịch" });
      } finally {
        if (reqId === availabilityReqId.current) onAvailabilityLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [
    mainCourseId,
    bookingDate,
    startTime,
    numberOfPeople,
    addonCourseIds,
    therapistRequestType,
    requestedTherapistId,
    requestedGender,
    shopId,
    submitting,
    onAvailability,
    onAvailabilityLoading,
    refreshToken,
    timezone,
    minimumBookingAdvanceMinutes,
  ]);

  return null;
}
