import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bookingUpdateFormSchema, shouldAutoAssignTherapists, toCreatePayload, toUpdatePayload, type BookingFormValues } from "./booking-form.schema";

describe("booking form backend contract", () => {
  it("tự động phân công lại khi thay đổi kích thước booking nhóm", () => {
    expect(shouldAutoAssignTherapists(1, 2)).toBe(true);
    expect(shouldAutoAssignTherapists(2, 3)).toBe(true);
    expect(shouldAutoAssignTherapists(3, 2)).toBe(true);
    expect(shouldAutoAssignTherapists(2, 2)).toBe(false);
    expect(shouldAutoAssignTherapists(2, 1)).toBe(false);
  });

  it("creates a payload containing only backend-supported fields", () => {
    const values: BookingFormValues = {
      shopId: "shop-id",
      bookingDate: "2026-07-21",
      startTime: "10:30",
      numberOfPeople: 1,
      customerPhone: "0901234567",
      customerName: "Nguyễn An",
      mainCourseId: "main-60",
      addonCourseIds: ["addon-15"],
      therapistRequestType: "specific",
      requestedTherapistId: "therapist-id",
      requestedGender: undefined,
      reservations: [],
      autoAssignTherapists: false,
    };

    expect(toCreatePayload(values)).toEqual({
      shop_id: "shop-id",
      booking_date: "2026-07-21",
      start_time: "10:30",
      number_of_people: 1,
      customer: { phone: "0901234567", name: "Nguyễn An" },
      courses: [
        { course_id: "main-60", course_role: "main" },
        { course_id: "addon-15", course_role: "addon" },
      ],
      therapist_request: { type: "specific", therapist_id: "therapist-id" },
      confirmed_by_customer: true,
    });
  });

  it("does not render controls for fields missing from the backend contract", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/booking/booking-form/booking-form-sections.tsx"),
      "utf8",
    );
    const unsupportedLabels = [
      "Mã thành viên",
      "Ngày sinh",
      "Giới tính khách",
      "Vị trí đau",
      "Không được chạm",
      "Nguồn booking",
      "Khoảng nghỉ",
      "Mức trò chuyện",
      "Lực massage",
      "Thay đồ",
      "Ghi chú",
    ];

    for (const label of unsupportedLabels) {
      expect(source).not.toContain(`>${label}<`);
    }
  });

  it("removes a specific therapist from group booking payloads", () => {
    const values: BookingFormValues = {
      shopId: "shop-id",
      bookingDate: "2026-07-21",
      startTime: "14:00",
      numberOfPeople: 2,
      customerPhone: "0901234567",
      customerName: "Nhóm hai người",
      mainCourseId: "main-60",
      addonCourseIds: [],
      therapistRequestType: "specific",
      requestedTherapistId: "therapist-a",
      requestedGender: undefined,
      reservations: [],
      autoAssignTherapists: false,
    };

    expect(toCreatePayload(values).therapist_request).toEqual({ type: "none" });
  });

  it("updates a group by booking id payload and reservation ids", () => {
    const values: BookingFormValues = {
      shopId: "shop-id",
      bookingDate: "2026-07-22",
      startTime: "15:00",
      numberOfPeople: 2,
      customerPhone: "0901234567",
      customerName: "Nhóm cập nhật",
      mainCourseId: "",
      addonCourseIds: [],
      therapistRequestType: "none",
      requestedTherapistId: "",
      requestedGender: undefined,
      reservations: [
        { reservationId: "reservation-1", personIndex: 1, therapistId: "therapist-1", mainCourseId: "main-60", addonCourseIds: ["addon-15"] },
        { reservationId: "reservation-2", personIndex: 2, therapistId: "therapist-2", mainCourseId: "main-60", addonCourseIds: ["addon-15"] },
      ],
      autoAssignTherapists: false,
    };

    expect(toUpdatePayload(values)).toEqual({
      booking_date: "2026-07-22",
      start_time: "15:00",
      customer: { phone: "0901234567", name: "Nhóm cập nhật" },
      reservations: [
        { reservation_id: "reservation-1", person_index: 1, therapist_id: "therapist-1", courses: [{ course_id: "main-60", course_role: "main" }, { course_id: "addon-15", course_role: "addon" }] },
        { reservation_id: "reservation-2", person_index: 2, therapist_id: "therapist-2", courses: [{ course_id: "main-60", course_role: "main" }, { course_id: "addon-15", course_role: "addon" }] },
      ],
      auto_assign_therapists: false,
    });
  });

  it("rejects different courses between people in a group", () => {
    const result = bookingUpdateFormSchema.safeParse({
      shopId: "shop-id",
      bookingDate: "2026-07-22",
      startTime: "15:00",
      numberOfPeople: 2,
      customerPhone: "0901234567",
      customerName: "Nhóm",
      mainCourseId: "",
      addonCourseIds: [],
      therapistRequestType: "none",
      requestedTherapistId: "",
      requestedGender: undefined,
      reservations: [
        { reservationId: "reservation-1", personIndex: 1, therapistId: "therapist-1", mainCourseId: "main-60", addonCourseIds: ["addon-15"] },
        { reservationId: "reservation-2", personIndex: 2, therapistId: "therapist-2", mainCourseId: "main-60", addonCourseIds: [] },
      ],
      autoAssignTherapists: false,
    });

    expect(result.success).toBe(false);
  });

  it("omits therapist ids when a single booking becomes a group", () => {
    expect(shouldAutoAssignTherapists(1, 2)).toBe(true);
    expect(shouldAutoAssignTherapists(1, 3)).toBe(true);
    expect(shouldAutoAssignTherapists(2, 3)).toBe(false);
    const values: BookingFormValues = {
      shopId: "shop-id",
      bookingDate: "2026-07-22",
      startTime: "15:00",
      numberOfPeople: 2,
      customerPhone: "0901234567",
      customerName: "Nhóm tự động",
      mainCourseId: "",
      addonCourseIds: [],
      therapistRequestType: "none",
      requestedTherapistId: "",
      requestedGender: undefined,
      reservations: [
        { reservationId: "reservation-1", personIndex: 1, therapistId: "", mainCourseId: "main-60", addonCourseIds: [] },
        { personIndex: 2, therapistId: "", mainCourseId: "main-60", addonCourseIds: [] },
      ],
      autoAssignTherapists: true,
    };

    expect(bookingUpdateFormSchema.safeParse(values).success).toBe(true);
    const payload = toUpdatePayload(values);
    expect(payload.auto_assign_therapists).toBe(true);
    expect(payload.reservations.every((reservation) => !("therapist_id" in reservation))).toBe(true);
  });
});
