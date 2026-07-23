"use client";

import { useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  restrictionCreateSchema,
  restrictionUpdateSchema,
  type RestrictionUiModel,
} from "@/features/restriction/restriction.types";
import {
  useCreateRestriction,
  useRestrictions,
  useUpdateRestriction,
} from "@/features/restriction/use-restriction-queries";
import { useAlert } from "@/shared/components/AlertProvider";
import {
  ActiveBadge,
  AdminDataState,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  firstValidationMessage,
  formatAdminDateTime,
} from "@/shared/components/admin/AdminUi";
import { Button } from "@/shared/components/ui/button";

// Quản lý form thêm hoặc cập nhật restriction, giữ số điện thoại bất biến khi chỉnh sửa.
function RestrictionForm({
  restriction,
  onClose,
}: {
  restriction: RestrictionUiModel | null;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState(restriction?.phone ?? "");
  const [reason, setReason] = useState(restriction?.reason ?? "");
  const [isActive, setIsActive] = useState(restriction?.isActive ?? true);
  const createMutation = useCreateRestriction();
  const updateMutation = useUpdateRestriction(restriction?.id ?? "");
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useAlert();
  const submitting = createMutation.isPending || updateMutation.isPending;

  // Validate form theo mode, gọi API và làm mới mọi bộ lọc restriction sau khi lưu.
  const handleSubmit = async () => {
    try {
      if (restriction) {
        const parsed = restrictionUpdateSchema.safeParse({
          reason: reason.trim() || undefined,
          is_active: isActive,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await updateMutation.mutateAsync(parsed.data);
      } else {
        const parsed = restrictionCreateSchema.safeParse({
          phone: phone.trim(),
          reason: reason.trim() || undefined,
          is_active: isActive,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await createMutation.mutateAsync(parsed.data);
      }
      await queryClient.invalidateQueries({ queryKey: ["restrictions"] });
      showSuccess(restriction ? "Đã cập nhật hạn chế khách hàng." : "Đã thêm khách hàng vào danh sách hạn chế.");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu hạn chế khách hàng.");
    }
  };

  return (
    <AdminModal open title={restriction ? "Chỉnh sửa hạn chế" : "Thêm khách hàng bị hạn chế"} description="Khách có restriction đang hoạt động sẽ không thể tạo booking mới." submitting={submitting} submitLabel={restriction ? "Lưu thay đổi" : "Thêm vào danh sách"} onClose={onClose} onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <AdminInput label="Số điện thoại" value={phone} disabled={Boolean(restriction)} onChange={(event) => setPhone(event.target.value)} />
        <AdminTextarea label="Lý do" placeholder="Nhập lý do hạn chế..." value={reason} onChange={(event) => setReason(event.target.value)} />
        <AdminSelect label="Trạng thái" value={isActive ? "active" : "inactive"} onChange={(event) => setIsActive(event.target.value === "active")}><option value="active">Đang hạn chế</option><option value="inactive">Đã gỡ hạn chế</option></AdminSelect>
      </div>
    </AdminModal>
  );
}

// Điều phối tìm kiếm theo số điện thoại, lọc trạng thái và CRUD danh sách hạn chế.
export function RestrictionManager() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; restriction: RestrictionUiModel } | null>(null);
  const query = useRestrictions({
    phone: phone.trim() || undefined,
    isActive: status === "all" ? undefined : status === "active",
  });

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-[minmax(240px,1fr)_180px_auto] sm:items-end">
        <div className="relative"><Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-zinc-400" /><AdminInput label="Số điện thoại" className="pl-9" placeholder="Tìm theo số điện thoại" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
        <AdminSelect label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Tất cả</option><option value="active">Đang hạn chế</option><option value="inactive">Đã gỡ</option></AdminSelect>
        <Button type="button" className="h-9 gap-2" onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Thêm hạn chế</Button>
      </div>

      <AdminDataState loading={query.isLoading} error={query.error} empty={(query.data ?? []).length === 0} emptyMessage="Không có khách hàng nào phù hợp bộ lọc.">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Số điện thoại</th><th className="px-4 py-3">Lý do</th><th className="px-4 py-3">Cập nhật</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-zinc-100">{(query.data ?? []).map((restriction) => <tr key={restriction.id} className="hover:bg-zinc-50"><td className="px-4 py-3 font-medium text-zinc-900">{restriction.phone}</td><td className="max-w-md px-4 py-3 text-zinc-600"><p className="truncate" title={restriction.reason ?? undefined}>{restriction.reason || "Không có lý do"}</p></td><td className="px-4 py-3 text-xs text-zinc-500">{formatAdminDateTime(restriction.updatedAt)}</td><td className="px-4 py-3"><ActiveBadge active={restriction.isActive} activeLabel="Đang hạn chế" inactiveLabel="Đã gỡ" /></td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", restriction })}><Pencil className="h-4 w-4" /> Sửa</Button></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-zinc-100 md:hidden">{(query.data ?? []).map((restriction) => <article key={restriction.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-medium text-zinc-900">{restriction.phone}</h2><p className="mt-1 line-clamp-2 text-sm text-zinc-600">{restriction.reason || "Không có lý do"}</p></div><ActiveBadge active={restriction.isActive} activeLabel="Đang hạn chế" inactiveLabel="Đã gỡ" /></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-zinc-400">{formatAdminDateTime(restriction.updatedAt)}</span><Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", restriction })}><Pencil className="h-4 w-4" /> Sửa</Button></div></article>)}</div>
        </div>
      </AdminDataState>

      {dialog && <RestrictionForm restriction={dialog.mode === "edit" ? dialog.restriction : null} onClose={() => setDialog(null)} />}
    </>
  );
}
