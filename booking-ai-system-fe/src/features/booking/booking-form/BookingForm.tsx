"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/shared/types/api-error";
import type { UUID } from "@/shared/types/common";
import { useCourses } from "@/features/course/use-course-queries";
import { useTherapists } from "@/features/therapist/use-therapist-queries";
import { useCheckEligibility } from "@/features/customer/use-customer-queries";
import { useCreateBooking, useUpdateBooking } from "./booking-form.mutations";
import { type EligibilityResult } from "./booking-form.queries";
import { BookingLiveChecks } from "./BookingLiveChecks";
import {
  bookingFormSchema,
  toCreatePayload,
  toUpdatePayload,
  type BookingFormInitial,
  type BookingFormValues,
} from "./booking-form.schema";
import { BUSINESS_HOURS } from "@/shared/config/shop";
import {
  BookingInfoRow,
  CustomerArea,
  CourseMatrix,
  TherapistRow,
  BookingSummaryBar,
} from "./booking-form-sections";

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  const [oh, om] = BUSINESS_HOURS.open.split(":").map(Number);
  const [ch, cm] = BUSINESS_HOURS.close.split(":").map(Number);
  const start = oh * 60 + om;
  const end = ch * 60 + cm;
  for (let m = start; m <= end; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
  }
  return out;
})();

export interface AvailabilityState {
  available: boolean;
  message?: string;
}

export interface BookingFormHandle {
  reset: () => void;
}

interface BookingFormProps {
  initial: BookingFormInitial;
  onSaved: (bookingId: UUID) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onAvailability?: (a: AvailabilityState | null) => void;
  onAvailabilityLoading?: (loading: boolean) => void;
  onFormError?: (err: string | null) => void;
}

export const BookingForm = forwardRef<BookingFormHandle, BookingFormProps>(function BookingForm({
  initial,
  onSaved,
  onDirtyChange,
  onAvailability,
  onAvailabilityLoading,
  onFormError,
}: BookingFormProps, ref) {
  const isEdit = initial.mode === "edit";

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      shopId: initial.shopId,
      bookingDate: initial.bookingDate,
      startTime: initial.startTime,
      numberOfPeople: 1,
      customerPhone: initial.customerPhone ?? "",
      customerName: initial.customerName ?? "",
      mainCourseId: "",
      addonCourseIds: [],
      therapistRequestType: initial.therapistId ? "specific" : "none",
      requestedTherapistId: initial.therapistId ?? "",
      requestedGender: undefined,
    },
  });

  const { data: courses = [] } = useCourses(initial.shopId, { isActive: true });
  const { data: therapists = [] } = useTherapists(initial.shopId, true);

  const createMut = useCreateBooking();
  const updateMut = useUpdateBooking(isEdit ? (initial.bookingId as UUID) : ("" as UUID));
  const eligibilityMut = useCheckEligibility();

  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      form.reset();
      setEligibility(null);
      setAvailability(null);
      setAvailabilityLoading(false);
      setFormError(null);
    },
  }), [form]);

  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Propagate availability/formError to parent (BookingDrawer footer)
  useEffect(() => { onAvailability?.(availability); }, [availability, onAvailability]);
  useEffect(() => { onAvailabilityLoading?.(availabilityLoading); }, [availabilityLoading, onAvailabilityLoading]);
  useEffect(() => { onFormError?.(formError); }, [formError, onFormError]);

  const applyApiErrors = (err: unknown) => {
    if (err instanceof ApiError) {
      const fields = err.fieldErrors();
      for (const [field, message] of Object.entries(fields)) {
        form.setError(field as keyof BookingFormValues, { message });
      }
      if (err.code === "SLOT_CONFLICT" || err.code === "THERAPIST_NOT_AVAILABLE") {
        setAvailability({ available: false, message: err.detail });
        setFormError(err.detail);
      } else if (err.code === "CUSTOMER_IN_NG_LIST") {
        setFormError("SĐT bị cấm đặt lịch (NG list).");
      } else {
        setFormError(err.detail || err.body.title || "Lỗi khi lưu booking.");
      }
    } else {
      setFormError("Lỗi không xác định khi lưu booking.");
    }
  };

  const onSubmit = form.handleSubmit(async (vals) => {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (isEdit && initial.bookingId) {
        await updateMut.mutateAsync(toUpdatePayload(vals));
        form.reset(vals);
        onSaved(initial.bookingId);
      } else {
        const created = await createMut.mutateAsync(toCreatePayload(vals));
        form.reset(vals);
        onSaved(created.booking_id);
      }
    } catch (err) {
      applyApiErrors(err);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <FormProvider {...form}>
      <form id="booking-form" onSubmit={onSubmit} className="space-y-3">
        <BookingLiveChecks
          form={form}
          shopId={initial.shopId}
          submitting={submitting}
          onEligibility={setEligibility}
          onAvailability={setAvailability}
          onAvailabilityLoading={setAvailabilityLoading}
        />

        {formError && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {formError}
          </div>
        )}

        {/* Hàng 1: Ngày, giờ, số người */}
        <BookingInfoRow
          timeOptions={TIME_OPTIONS}
          bookingCode={isEdit ? initial.bookingId : undefined}
        />

        {/* Hàng 2: Khách hàng */}
        <CustomerArea
          eligibility={eligibility}
          eligibilityLoading={eligibilityMut.isPending}
          onCheck={() => {
            const ph = form.getValues("customerPhone");
            if (ph)
              eligibilityMut
                .mutateAsync({ phone: ph, shop_id: initial.shopId })
                .then(setEligibility)
                .catch(() => setEligibility(null));
          }}
        />

        {/* Hàng 3: Course matrix */}
        <CourseMatrix courses={courses} />

        {/* Hàng 4: Therapist */}
        <TherapistRow therapists={therapists} />

        {/* Summary bar hiển thị trong form để footer gọi */}
        <BookingSummaryBar
          courses={courses}
          availability={availability}
          availabilityLoading={availabilityLoading}
        />
      </form>
    </FormProvider>
  );
});
