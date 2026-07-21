"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/shared/types/api-error";
import type { UUID } from "@/shared/types/common";
import { useCourses } from "@/features/course/use-course-queries";
import { useTherapists } from "@/features/therapist/use-therapist-queries";
import type { CourseUiModel } from "@/features/course/course.types";
import type { TherapistUiModel } from "@/features/therapist/therapist.types";
import { useCheckEligibility } from "@/features/customer/use-customer-queries";
import { useCreateBooking, useUpdateBooking } from "./booking-form.mutations";
import { type EligibilityResult } from "./booking-form.queries";
import { BookingLiveChecks } from "./BookingLiveChecks";
import {
  bookingFormSchema,
  bookingUpdateFormSchema,
  toCreatePayload,
  toUpdatePayload,
  type BookingFormInitial,
  type BookingFormValues,
} from "./booking-form.schema";
import { BUSINESS_HOURS, SHOP_TIMEZONE } from "@/shared/config/shop";
import {
  BookingBasicInfoRow,
  BookingCustomerRow,
  BookingCourseMatrix,
  BookingEditDetails,
  BookingTherapistRow,
} from "./booking-form-sections";
import type { AdminBookingDetailRaw } from "../schedule.types";
import { parseTimeToMinutes } from "../schedule.utils";
import {
  earliestSelectableForDate,
  validateBookingStart,
} from "../booking-time";

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

const EMPTY_COURSES: CourseUiModel[] = [];
const EMPTY_THERAPISTS: TherapistUiModel[] = [];

export interface AvailabilityState {
  available: boolean;
  message?: string;
  reasonCode?: string;
  availableTherapistCount?: number;
  requiredTherapistCount?: number;
}

export interface BookingFormHandle {
  reset: () => void;
  checkAvailability: () => void;
}

export interface BookingFormSummary {
  bookingDate: string;
  startTime: string;
  numberOfPeople: number;
  durationMinutes: number;
  totalPrice: number;
}

interface BookingFormProps {
  initial: BookingFormInitial;
  onSaved: (bookingId: UUID) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onAvailability?: (a: AvailabilityState | null) => void;
  onAvailabilityLoading?: (loading: boolean) => void;
  onFormError?: (err: string | null) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onSummaryChange?: (summary: BookingFormSummary) => void;
  editDetail?: AdminBookingDetailRaw;
}

export const BookingForm = forwardRef<BookingFormHandle, BookingFormProps>(function BookingForm({
  initial,
  onSaved,
  onDirtyChange,
  onAvailability,
  onAvailabilityLoading,
  onFormError,
  onSubmittingChange,
  onSummaryChange,
  editDetail,
}: BookingFormProps, ref) {
  const isEdit = initial.mode === "edit";

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(isEdit ? bookingUpdateFormSchema : bookingFormSchema),
    defaultValues: {
      shopId: initial.shopId,
      bookingDate: initial.bookingDate,
      startTime: initial.startTime,
      numberOfPeople: initial.numberOfPeople ?? 1,
      customerPhone: initial.customerPhone ?? "",
      customerName: initial.customerName ?? "",
      mainCourseId: "",
      addonCourseIds: [],
      therapistRequestType: initial.therapistId ? "specific" : "none",
      requestedTherapistId: initial.therapistId ?? "",
      requestedGender: undefined,
    },
  });

  const { data: courseData } = useCourses(initial.shopId, { isActive: true });
  const { data: therapistData } = useTherapists(initial.shopId, true);
  const courses = courseData ?? EMPTY_COURSES;
  const therapists = therapistData ?? EMPTY_THERAPISTS;

  const createMut = useCreateBooking();
  const updateMut = useUpdateBooking(isEdit ? (initial.bookingId as UUID) : ("" as UUID));
  const eligibilityMut = useCheckEligibility();

  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [availability, setAvailability] = useState<AvailabilityState | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [availabilityRefreshToken, setAvailabilityRefreshToken] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const bookingDate = form.watch("bookingDate");
  const startTime = form.watch("startTime");
  const numberOfPeople = form.watch("numberOfPeople");
  const mainCourseId = form.watch("mainCourseId");
  const addonCourseIds = form.watch("addonCourseIds");
  const timezone = initial.timezone ?? SHOP_TIMEZONE;
  const minimumBookingAdvanceMinutes = initial.minimumBookingAdvanceMinutes ?? 15;
  const earliestSelectableMinutes = isEdit
    ? null
    : earliestSelectableForDate({
        bookingDate,
        stepMinutes: 15,
        timeZone: timezone,
        now,
        advanceMinutes: minimumBookingAdvanceMinutes,
      });
  const timeOptions = useMemo(
    () => TIME_OPTIONS.map((option) => ({
      ...option,
      disabled:
        earliestSelectableMinutes !== null &&
        parseTimeToMinutes(option.value) < earliestSelectableMinutes,
    })),
    [earliestSelectableMinutes],
  );
  const selectedTimeValidation = isEdit
    ? { valid: true }
    : validateBookingStart({
        bookingDate,
        startMinutes: parseTimeToMinutes(startTime),
        timeZone: timezone,
        now,
        advanceMinutes: minimumBookingAdvanceMinutes,
      });
  const summary = useMemo<BookingFormSummary>(() => {
    const selectedCourses = courses.filter(
      (course) => course.id === mainCourseId || addonCourseIds.includes(course.id),
    );
    return {
      bookingDate,
      startTime,
      numberOfPeople,
      durationMinutes: isEdit
        ? (initial.durationMinutes ?? 0)
        : selectedCourses.reduce((total, course) => total + course.durationMinutes, 0),
      totalPrice: isEdit
        ? (initial.totalPrice ?? 0)
        : selectedCourses.reduce((total, course) => total + course.price, 0),
    };
  }, [addonCourseIds, bookingDate, courses, initial.durationMinutes, initial.totalPrice, isEdit, mainCourseId, numberOfPeople, startTime]);
  const lastEmittedSummaryRef = useRef<BookingFormSummary | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      form.reset();
      setEligibility(null);
      setAvailability(null);
      setAvailabilityLoading(false);
      setFormError(null);
    },
    checkAvailability: () => setAvailabilityRefreshToken((token) => token + 1),
  }), [form]);

  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Propagate availability/formError to parent (BookingDrawer footer)
  useEffect(() => { onAvailability?.(availability); }, [availability, onAvailability]);
  useEffect(() => { onAvailabilityLoading?.(availabilityLoading); }, [availabilityLoading, onAvailabilityLoading]);
  useEffect(() => { onFormError?.(formError); }, [formError, onFormError]);
  useEffect(() => { onSubmittingChange?.(submitting); }, [onSubmittingChange, submitting]);
  useEffect(() => {
    const previous = lastEmittedSummaryRef.current;
    if (
      previous?.bookingDate === summary.bookingDate &&
      previous.startTime === summary.startTime &&
      previous.numberOfPeople === summary.numberOfPeople &&
      previous.durationMinutes === summary.durationMinutes &&
      previous.totalPrice === summary.totalPrice
    ) {
      return;
    }
    lastEmittedSummaryRef.current = summary;
    onSummaryChange?.(summary);
  }, [onSummaryChange, summary]);

  const applyApiErrors = (err: unknown) => {
    if (err instanceof ApiError) {
      const fields = err.fieldErrors();
      for (const [field, message] of Object.entries(fields)) {
        form.setError(field as keyof BookingFormValues, { message });
      }
      if (err.code === "BOOKING_START_IN_PAST" || err.code === "BOOKING_START_TOO_SOON") {
        const message = err.detail || "Thời gian bắt đầu không còn hợp lệ.";
        form.setError("startTime", { type: "server", message });
        setAvailability({ available: false, message });
        setFormError(message);
        setAvailabilityRefreshToken((token) => token + 1);
      } else if (
        err.code === "SLOT_CONFLICT" ||
        err.code === "THERAPIST_NOT_AVAILABLE" ||
        err.code === "INSUFFICIENT_AVAILABLE_THERAPISTS" ||
        err.code === "OUTSIDE_SHIFT" ||
        err.code === "OUTSIDE_BUSINESS_HOURS" ||
        err.code === "GROUP_BOOKING_CANNOT_REQUEST_SPECIFIC_THERAPIST"
      ) {
        setAvailability({
          available: false,
          reasonCode: err.code,
          message: err.detail,
        });
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
      <form id="booking-form" onSubmit={onSubmit} className="mx-auto w-full max-w-[1800px] space-y-0">
        {!isEdit && (
          <BookingLiveChecks
            form={form}
            shopId={initial.shopId}
            submitting={submitting}
            onEligibility={setEligibility}
            onAvailability={setAvailability}
            onAvailabilityLoading={setAvailabilityLoading}
            refreshToken={availabilityRefreshToken}
            timezone={timezone}
            minimumBookingAdvanceMinutes={minimumBookingAdvanceMinutes}
          />
        )}

        {/* Hàng 1: Ngày, giờ, số người */}
        <BookingBasicInfoRow
          timeOptions={timeOptions}
          bookingCode={isEdit ? initial.bookingId : undefined}
          timeNotice={!selectedTimeValidation.valid ? selectedTimeValidation.message : undefined}
          numberOfPeopleReadOnly={isEdit}
        />

        {isEdit && editDetail && <BookingEditDetails detail={editDetail} />}

        {!isEdit && (
          <>
            {/* Hàng 2: Khách hàng */}
            <BookingCustomerRow
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
            <BookingCourseMatrix courses={courses} />

            {/* Hàng 4: Therapist */}
            <BookingTherapistRow therapists={therapists} />
          </>
        )}
      </form>
    </FormProvider>
  );
});
