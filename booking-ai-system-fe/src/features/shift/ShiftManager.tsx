"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Pencil, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  shiftCreateSchema,
  shiftUpdateSchema,
  type ShiftUiModel,
} from "@/features/shift/shift.types";
import {
  useCreateShift,
  useShifts,
  useUpdateShift,
} from "@/features/shift/use-shift-queries";
import { useShops } from "@/features/shop/use-shop-queries";
import { useTherapists } from "@/features/therapist/use-therapist-queries";
import { useAlert } from "@/shared/components/AlertProvider";
import {
  ActiveBadge,
  AdminDataState,
  AdminInput,
  AdminModal,
  AdminSelect,
  firstValidationMessage,
} from "@/shared/components/admin/AdminUi";
import { Button } from "@/shared/components/ui/button";
import { todayShopDate } from "@/shared/lib/datetime";
import type { UUID } from "@/shared/types/common";

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

interface ShiftFormState {
  therapistId: UUID;
  workDate: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

// Tạo dữ liệu form ca làm việc và loại bỏ phần giây khỏi time trả về từ backend.
function createShiftFormState(shift: ShiftUiModel | null, therapistId: UUID, workDate: string): ShiftFormState {
  return {
    therapistId: shift?.therapistId ?? therapistId,
    workDate: shift?.workDate ?? workDate,
    startTime: shift?.startTime.slice(0, 5) ?? "09:00",
    endTime: shift?.endTime.slice(0, 5) ?? "18:00",
    isActive: shift?.isActive ?? true,
  };
}

// Quản lý form ca làm việc, dùng dropdown 24 giờ và gọi mutation create/update đúng contract backend.
function ShiftForm({
  shopId,
  shift,
  defaultDate,
  therapists,
  onClose,
}: {
  shopId: UUID;
  shift: ShiftUiModel | null;
  defaultDate: string;
  therapists: Array<{ id: UUID; name: string }>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => createShiftFormState(shift, therapists[0]?.id ?? "", defaultDate));
  const createMutation = useCreateShift();
  const updateMutation = useUpdateShift(shift?.id ?? "");
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useAlert();
  const submitting = createMutation.isPending || updateMutation.isPending;

  // Kiểm tra thứ tự thời gian tại UI trước khi gửi để admin nhận phản hồi nhanh và rõ ràng.
  const handleSubmit = async () => {
    if (form.startTime >= form.endTime) {
      showError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    try {
      if (shift) {
        const parsed = shiftUpdateSchema.safeParse({
          start_time: form.startTime,
          end_time: form.endTime,
          is_active: form.isActive,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await updateMutation.mutateAsync(parsed.data);
      } else {
        const parsed = shiftCreateSchema.safeParse({
          shop_id: shopId,
          therapist_id: form.therapistId,
          work_date: form.workDate,
          start_time: form.startTime,
          end_time: form.endTime,
          is_active: form.isActive,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await createMutation.mutateAsync(parsed.data);
      }
      await queryClient.invalidateQueries({ queryKey: ["shifts", shopId] });
      showSuccess(shift ? "Đã cập nhật ca làm việc." : "Đã tạo ca làm việc.");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu ca làm việc.");
    }
  };

  return (
    <AdminModal open title={shift ? "Chỉnh sửa ca làm việc" : "Thêm ca làm việc"} description="Một therapist không thể có hai ca hoạt động chồng thời gian trong cùng ngày." submitting={submitting} submitLabel={shift ? "Lưu thay đổi" : "Tạo ca"} onClose={onClose} onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminSelect label="Therapist" value={form.therapistId} disabled={Boolean(shift)} onChange={(event) => setForm((current) => ({ ...current, therapistId: event.target.value }))}>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)}</AdminSelect>
        <AdminInput label="Ngày làm việc" type="date" value={form.workDate} disabled={Boolean(shift)} onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} />
        <AdminSelect label="Giờ bắt đầu" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}>{TIME_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</AdminSelect>
        <AdminSelect label="Giờ kết thúc" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}>{TIME_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}</AdminSelect>
        <AdminSelect label="Trạng thái" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}><option value="active">Hoạt động</option><option value="inactive">Tạm tắt</option></AdminSelect>
      </div>
    </AdminModal>
  );
}

// Điều phối bộ lọc shop, ngày, therapist và danh sách ca làm việc trên desktop lẫn mobile.
export function ShiftManager() {
  const shopsQuery = useShops(true);
  const [shopId, setShopId] = useState<UUID>("");
  const [workDate, setWorkDate] = useState(todayShopDate());
  const [therapistId, setTherapistId] = useState<UUID>("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; shift: ShiftUiModel } | null>(null);
  const activeShopId = shopId || shopsQuery.data?.[0]?.id || "";
  const therapistsQuery = useTherapists(activeShopId);
  const shiftsQuery = useShifts(activeShopId, {
    workDate,
    therapistId: therapistId || undefined,
    isActive: status === "all" ? undefined : status === "active",
  });
  const therapistNames = useMemo(
    () => new Map((therapistsQuery.data ?? []).map((therapist) => [therapist.id, therapist.name])),
    [therapistsQuery.data],
  );

  // Đổi shop đồng thời xóa therapist filter vì therapist cũ không thuộc shop mới.
  const handleShopChange = (nextShopId: UUID) => {
    setShopId(nextShopId);
    setTherapistId("");
  };

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-[220px_160px_220px_150px_auto] xl:items-end">
        <AdminSelect label="Shop" value={activeShopId} disabled={shopsQuery.isLoading} onChange={(event) => handleShopChange(event.target.value)}>{(shopsQuery.data ?? []).map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</AdminSelect>
        <AdminInput label="Ngày làm việc" type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
        <AdminSelect label="Therapist" value={therapistId} onChange={(event) => setTherapistId(event.target.value)}><option value="">Tất cả therapist</option>{(therapistsQuery.data ?? []).map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.name}</option>)}</AdminSelect>
        <AdminSelect label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Tất cả</option><option value="active">Hoạt động</option><option value="inactive">Tạm tắt</option></AdminSelect>
        <Button type="button" className="h-9 gap-2" disabled={!activeShopId || !(therapistsQuery.data?.length)} onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Thêm ca</Button>
      </div>

      <AdminDataState loading={shopsQuery.isLoading || therapistsQuery.isLoading || shiftsQuery.isLoading} error={shopsQuery.error ?? therapistsQuery.error ?? shiftsQuery.error} empty={(shiftsQuery.data ?? []).length === 0} emptyMessage="Không có ca làm việc phù hợp bộ lọc.">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="hidden md:block"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Therapist</th><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Khung giờ</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-zinc-100">{(shiftsQuery.data ?? []).map((shift) => <tr key={shift.id} className="hover:bg-zinc-50"><td className="px-4 py-3 font-medium text-zinc-900">{therapistNames.get(shift.therapistId) ?? "Therapist"}</td><td className="px-4 py-3 text-zinc-600">{shift.workDate}</td><td className="px-4 py-3 font-medium text-zinc-700">{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</td><td className="px-4 py-3"><ActiveBadge active={shift.isActive} /></td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", shift })}><Pencil className="h-4 w-4" /> Sửa</Button></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-zinc-100 md:hidden">{(shiftsQuery.data ?? []).map((shift) => <article key={shift.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-medium text-zinc-900">{therapistNames.get(shift.therapistId) ?? "Therapist"}</h2><p className="text-xs text-zinc-500">{shift.workDate}</p></div><ActiveBadge active={shift.isActive} /></div><div className="mt-3 flex items-center justify-between"><span className="font-medium text-zinc-700">{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}</span><Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", shift })}><Pencil className="h-4 w-4" /> Sửa</Button></div></article>)}</div>
        </div>
      </AdminDataState>

      {activeShopId && !therapistsQuery.isLoading && !(therapistsQuery.data?.length) && <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500"><CalendarRange className="mx-auto mb-2 h-8 w-8" />Shop chưa có therapist để tạo ca.</div>}
      {dialog && activeShopId && <ShiftForm shopId={activeShopId} shift={dialog.mode === "edit" ? dialog.shift : null} defaultDate={workDate} therapists={(therapistsQuery.data ?? []).map((therapist) => ({ id: therapist.id, name: therapist.name }))} onClose={() => setDialog(null)} />}
    </>
  );
}
