"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, UsersRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  therapistCreateSchema,
  therapistUpdateSchema,
  type TherapistUiModel,
} from "@/features/therapist/therapist.types";
import {
  useCreateTherapist,
  useTherapists,
  useUpdateTherapist,
} from "@/features/therapist/use-therapist-queries";
import { useShops } from "@/features/shop/use-shop-queries";
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
import type { Gender, UUID } from "@/shared/types/common";

interface TherapistFormState {
  posCode: string;
  name: string;
  gender: Gender;
  isActive: boolean;
}

// Chuyển therapist hiện tại thành dữ liệu form hoặc tạo form rỗng cho thao tác thêm mới.
function createTherapistFormState(therapist: TherapistUiModel | null): TherapistFormState {
  return {
    posCode: therapist?.posCode ?? "",
    name: therapist?.name ?? "",
    gender: therapist?.gender ?? "female",
    isActive: therapist?.isActive ?? true,
  };
}

// Quản lý form therapist, validate contract và cập nhật cache theo shop sau khi mutation thành công.
function TherapistForm({
  shopId,
  therapist,
  onClose,
}: {
  shopId: UUID;
  therapist: TherapistUiModel | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => createTherapistFormState(therapist));
  const createMutation = useCreateTherapist(shopId);
  const updateMutation = useUpdateTherapist(therapist?.id ?? "");
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useAlert();
  const submitting = createMutation.isPending || updateMutation.isPending;

  // Gửi dữ liệu therapist đã chuẩn hóa tới backend và phản hồi kết quả bằng alert dùng chung.
  const handleSubmit = async () => {
    try {
      const sharedFields = {
        name: form.name.trim(),
        gender: form.gender,
        is_active: form.isActive,
      };
      if (therapist) {
        const parsed = therapistUpdateSchema.safeParse(sharedFields);
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await updateMutation.mutateAsync(parsed.data);
      } else {
        const parsed = therapistCreateSchema.safeParse({
          pos_therapist_code: form.posCode.trim(),
          ...sharedFields,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await createMutation.mutateAsync(parsed.data);
      }
      await queryClient.invalidateQueries({ queryKey: ["therapists", shopId] });
      showSuccess(therapist ? "Đã cập nhật therapist." : "Đã thêm therapist.");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu therapist.");
    }
  };

  return (
    <AdminModal open title={therapist ? "Chỉnh sửa therapist" : "Thêm therapist"} description="Mã POS phải duy nhất trong shop và được dùng khi đồng bộ dữ liệu." submitting={submitting} submitLabel={therapist ? "Lưu thay đổi" : "Thêm therapist"} onClose={onClose} onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput label="Tên nhân viên" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <AdminInput label="Mã POS" value={form.posCode} disabled={Boolean(therapist)} onChange={(event) => setForm((current) => ({ ...current, posCode: event.target.value }))} />
        <AdminSelect label="Giới tính" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as Gender }))}>
          <option value="female">Nữ</option><option value="male">Nam</option>
        </AdminSelect>
        <AdminSelect label="Trạng thái" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}>
          <option value="active">Hoạt động</option><option value="inactive">Tạm tắt</option>
        </AdminSelect>
      </div>
    </AdminModal>
  );
}

// Điều phối chọn shop, tìm kiếm, lọc trạng thái và hiển thị CRUD therapist responsive.
export function TherapistManager() {
  const shopsQuery = useShops(true);
  const [shopId, setShopId] = useState<UUID>("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; therapist: TherapistUiModel } | null>(null);
  const activeShopId = shopId || shopsQuery.data?.[0]?.id || "";
  const therapistsQuery = useTherapists(activeShopId, status === "all" ? undefined : status === "active");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return therapistsQuery.data ?? [];
    return (therapistsQuery.data ?? []).filter((therapist) =>
      [therapist.name, therapist.posCode].some((value) => value.toLocaleLowerCase().includes(keyword)),
    );
  }, [search, therapistsQuery.data]);

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(220px,1fr)_160px_auto] lg:items-end">
        <AdminSelect label="Shop" value={activeShopId} disabled={shopsQuery.isLoading} onChange={(event) => setShopId(event.target.value)}>{(shopsQuery.data ?? []).map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</AdminSelect>
        <div className="relative"><Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-zinc-400" /><AdminInput label="Tìm kiếm" className="pl-9" placeholder="Tên hoặc mã POS" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <AdminSelect label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Tất cả</option><option value="active">Hoạt động</option><option value="inactive">Tạm tắt</option></AdminSelect>
        <Button type="button" className="h-9 gap-2" disabled={!activeShopId} onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Thêm therapist</Button>
      </div>

      <AdminDataState loading={shopsQuery.isLoading || therapistsQuery.isLoading} error={shopsQuery.error ?? therapistsQuery.error} empty={filtered.length === 0} emptyMessage="Shop chưa có therapist phù hợp bộ lọc.">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="hidden md:block"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Therapist</th><th className="px-4 py-3">Mã POS</th><th className="px-4 py-3">Giới tính</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-zinc-100">{filtered.map((therapist) => <tr key={therapist.id} className="hover:bg-zinc-50"><td className="px-4 py-3 font-medium text-zinc-900">{therapist.name}</td><td className="px-4 py-3 text-zinc-600">{therapist.posCode}</td><td className="px-4 py-3 text-zinc-600">{therapist.gender === "female" ? "Nữ" : "Nam"}</td><td className="px-4 py-3"><ActiveBadge active={therapist.isActive} /></td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", therapist })}><Pencil className="h-4 w-4" /> Sửa</Button></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-zinc-100 md:hidden">{filtered.map((therapist) => <article key={therapist.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-medium text-zinc-900">{therapist.name}</h2><p className="text-xs text-zinc-500">{therapist.posCode} · {therapist.gender === "female" ? "Nữ" : "Nam"}</p></div><ActiveBadge active={therapist.isActive} /></div><Button type="button" variant="ghost" className="mt-3 h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", therapist })}><Pencil className="h-4 w-4" /> Chỉnh sửa</Button></article>)}</div>
        </div>
      </AdminDataState>

      {!activeShopId && !shopsQuery.isLoading && <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500"><UsersRound className="mx-auto mb-2 h-8 w-8" />Hãy tạo shop trước khi thêm therapist.</div>}
      {dialog && activeShopId && <TherapistForm shopId={activeShopId} therapist={dialog.mode === "edit" ? dialog.therapist : null} onClose={() => setDialog(null)} />}
    </>
  );
}
