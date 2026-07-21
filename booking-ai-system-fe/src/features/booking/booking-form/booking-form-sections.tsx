"use client";

import { useFormContext, useWatch } from "react-hook-form";
import type { BookingFormValues } from "./booking-form.schema";
import type { CourseUiModel } from "@/features/course/course.types";
import type { TherapistUiModel } from "@/features/therapist/therapist.types";
import type { EligibilityResult } from "./booking-form.queries";
import { GENDERS, THERAPIST_REQUEST_TYPES } from "@/shared/types/common";

// ─── Compact helpers ────────────────────────────────────────────────────
const labelCls = "text-[11px] font-semibold text-zinc-500 mb-0.5";
const chipBase =
  "h-7 px-2.5 text-xs rounded border font-medium transition-colors cursor-pointer select-none";

// ─── Errors ─────────────────────────────────────────────────────────────
function FieldError({ name }: { name: keyof BookingFormValues }) {
  const { formState: { errors } } = useFormContext<BookingFormValues>();
  const err = errors[name];
  if (!err) return null;
  return <span className="text-[11px] text-red-600 ml-1">{err.message as string}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. BookingInfoRow — ngày, giờ, số người, mã booking (nếu edit)
// ═══════════════════════════════════════════════════════════════════════════
export function BookingInfoRow({
  timeOptions,
  bookingCode,
}: {
  timeOptions: { value: string; label: string }[];
  bookingCode?: string;
}) {
  const { register } = useFormContext<BookingFormValues>();
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 pb-2.5">
      <div>
        <label className={labelCls}>Ngày</label>
        <input type="date" className="h-8 rounded border border-zinc-300 px-2 text-xs" {...register("bookingDate")} />
        <FieldError name="bookingDate" />
      </div>
      <div>
        <label className={labelCls}>Giờ</label>
        <select className="h-8 rounded border border-zinc-300 px-2 text-xs" {...register("startTime")}>
          {timeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <FieldError name="startTime" />
      </div>
      <div>
        <label className={labelCls}>Số người</label>
        <input type="number" min={1} max={3} className="h-8 w-16 rounded border border-zinc-300 px-2 text-xs" {...register("numberOfPeople", { valueAsNumber: true })} />
        <FieldError name="numberOfPeople" />
      </div>
      {bookingCode && (
        <div>
          <label className={labelCls}>Mã booking</label>
          <div className="h-8 flex items-center text-xs font-medium text-zinc-700 bg-zinc-50 px-2 rounded border border-zinc-200">
            {bookingCode}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. CustomerArea — phone + search, name, eligibility result
// ═══════════════════════════════════════════════════════════════════════════
export function CustomerArea({
  eligibility,
  eligibilityLoading,
  onCheck,
}: {
  eligibility?: EligibilityResult | null;
  eligibilityLoading?: boolean;
  onCheck: () => void;
}) {
  const { register } = useFormContext<BookingFormValues>();
  const phone = useWatch({ name: "customerPhone" });
  const cust = eligibility?.customer;

  return (
    <div className="border-b border-zinc-200 pb-2.5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>Số điện thoại</label>
          <div className="flex items-center gap-2">
            <input className="h-8 w-[140px] rounded border border-zinc-300 px-2 text-xs" placeholder="0912..." {...register("customerPhone")} />
            <button type="button" onClick={onCheck} disabled={!phone || eligibilityLoading} className="h-8 px-2.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40" aria-label="Tra cứu">
              {eligibilityLoading ? <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Tra cứu"}
            </button>
          </div>
          <FieldError name="customerPhone" />
        </div>
        <div>
          <label className={labelCls}>Tên khách</label>
          <input className="h-8 w-[160px] rounded border border-zinc-300 px-2 text-xs" placeholder="Họ tên" {...register("customerName")} />
        </div>
      </div>
      {eligibility && (
        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-500">
          {cust ? (
            <>
              <span className="font-medium text-zinc-700">{cust.name ?? "(chưa tên)"}</span>
              <span className="text-zinc-300">|</span>
              <span className={cust.is_member ? "text-blue-600 font-medium" : ""}>{cust.is_member ? "Thành viên" : "Guest"}</span>
              <span className="text-zinc-300">|</span>
              <span>Lần thứ {cust.visit_count}</span>
              {cust.is_member && cust.member_rank && (
                <>
                  <span className="text-zinc-300">|</span>
                  <span className="text-amber-600 font-medium">{cust.member_rank}</span>
                </>
              )}
            </>
          ) : (
            <span className="text-amber-600">Khách mới — sẽ tạo khi lưu</span>
          )}
          {!eligibility.eligible && <span className="ml-2 font-medium text-red-600">⛔ SĐT bị cấm (NG list)</span>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. CourseMatrix — courses grouped by type, each with duration buttons
// ═══════════════════════════════════════════════════════════════════════════
export function CourseMatrix({ courses }: { courses: CourseUiModel[] }) {
  const { setValue, watch } = useFormContext<BookingFormValues>();
  const mainCourseId = watch("mainCourseId");
  const addonCourseIds = watch("addonCourseIds");

  const mains = courses.filter((c) => c.courseType === "main");
  const addons = courses.filter((c) => c.courseType === "addon");

  return (
    <div className="border-b border-zinc-200 pb-2.5 space-y-2">
      {/* Main courses */}
      <div>
        <span className={labelCls}>Course chính</span>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {mains.map((c) => {
            const selected = mainCourseId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setValue("mainCourseId", selected ? "" : c.id, { shouldDirty: true, shouldValidate: true })}
                className={`${chipBase} ${selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-700 border-zinc-300 hover:border-blue-400"}`}
              >
                <span className="font-medium">{c.name}</span>
                <span className="ml-1.5 opacity-70">({c.durationMinutes}p)</span>
                {c.price > 0 && <span className="ml-1 opacity-60">{c.price.toLocaleString("vi-VN")}₫</span>}
              </button>
            );
          })}
          {mains.length === 0 && <span className="text-xs text-zinc-400 italic py-1">Không có course chính</span>}
        </div>
        <FieldError name="mainCourseId" />
      </div>
      {/* Addon courses */}
      {addons.length > 0 && (
        <div>
          <span className={labelCls}>Course thêm</span>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {addons.map((c) => {
              const selected = addonCourseIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? addonCourseIds.filter((id: string) => id !== c.id)
                      : [...addonCourseIds, c.id];
                    setValue("addonCourseIds", next, { shouldDirty: true });
                  }}
                  className={`${chipBase} ${selected ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-zinc-700 border-zinc-300 hover:border-emerald-400"}`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-1.5 opacity-70">({c.durationMinutes}p)</span>
                  {c.price > 0 && <span className="ml-1 opacity-60">{c.price.toLocaleString("vi-VN")}₫</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. TherapistRow — request type + therapist select
// ═══════════════════════════════════════════════════════════════════════════
export function TherapistRow({ therapists }: { therapists: TherapistUiModel[] }) {
  const { register, setValue } = useFormContext<BookingFormValues>();
  const requestType = useWatch({ name: "therapistRequestType" });
  const therapistOptions = therapists.map((t) => ({ value: t.id, label: `${t.name} (${t.gender === "male" ? "Nam" : "Nữ"})` }));
  const genderOptions = GENDERS.map((g) => ({ value: g, label: g === "male" ? "Nam" : "Nữ" }));

  return (
    <div className="border-b border-zinc-200 pb-2.5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>Yêu cầu therapist</label>
          <div className="flex rounded border border-zinc-300 overflow-hidden h-8">
            {THERAPIST_REQUEST_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setValue("therapistRequestType", t, { shouldDirty: true, shouldValidate: true });
                  if (t === "none") {
                    setValue("requestedTherapistId", "", { shouldDirty: true });
                    setValue("requestedGender", undefined, { shouldDirty: true });
                  }
                }}
                className={`px-2.5 text-xs font-medium transition-colors ${
                  requestType === t
                    ? "bg-blue-600 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {t === "none" ? "Không yêu cầu" : t === "specific" ? "Cụ thể" : "Theo giới tính"}
              </button>
            ))}
          </div>
        </div>
        {requestType === "specific" && (
          <div>
            <label className={labelCls}>Chọn therapist</label>
            <select className="h-8 rounded border border-zinc-300 px-2 text-xs min-w-[160px]" {...register("requestedTherapistId")}>
              <option value="">-- Chọn --</option>
              {therapistOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <FieldError name="requestedTherapistId" />
          </div>
        )}
        {requestType === "gender" && (
          <div>
            <label className={labelCls}>Giới tính</label>
            <select className="h-8 rounded border border-zinc-300 px-2 text-xs" {...register("requestedGender")}>
              <option value="">-- Chọn --</option>
              {genderOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <FieldError name="requestedGender" />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. BookingSummaryBar — tổng duration, giá, availability (trong footer)
// ═══════════════════════════════════════════════════════════════════════════
export function BookingSummaryBar({
  courses,
  availability,
  availabilityLoading,
}: {
  courses: CourseUiModel[];
  availability?: { available: boolean; message?: string } | null;
  availabilityLoading?: boolean;
}) {
  const { watch } = useFormContext<BookingFormValues>();
  const values = watch();
  const selected = courses.filter(
    (c) => c.id === values.mainCourseId || values.addonCourseIds.includes(c.id),
  );
  const totalMin = selected.reduce((s, c) => s + c.durationMinutes, 0);
  const totalPrice = selected.reduce((s, c) => s + c.price, 0);

  return (
    <div className="flex items-center gap-3 text-xs text-zinc-600">
      {totalMin > 0 && (
        <span className="font-medium text-zinc-800">
          Tổng: <b className="text-blue-700">{totalMin}p</b>
          {" · "}
          <b className="text-emerald-700">{totalPrice.toLocaleString("vi-VN")}₫</b>
        </span>
      )}
      {totalMin > 0 && <span className="text-zinc-300">|</span>}
      {availabilityLoading ? (
        <span className="text-zinc-400 italic">Đang kiểm tra...</span>
      ) : availability ? (
        availability.available ? (
          <span className="font-medium text-emerald-600">✔ Khả dụng</span>
        ) : (
          <span className="font-medium text-red-600">✖ {availability.message ?? "Trùng lịch"}</span>
        )
      ) : (
        <span className="text-zinc-400 italic">Chưa kiểm tra</span>
      )}
      {values.numberOfPeople > 1 && (
        <>
          <span className="text-zinc-300">|</span>
          <span>{values.numberOfPeople} người</span>
        </>
      )}
    </div>
  );
}
