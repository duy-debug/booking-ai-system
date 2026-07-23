"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  shopCreateSchema,
  shopUpdateSchema,
  type ShopUiModel,
} from "@/features/shop/shop.types";
import {
  useCreateShop,
  useShops,
  useUpdateShop,
} from "@/features/shop/use-shop-queries";
import { ShopBreakSelector } from "@/features/shop/ShopBreakSelector";
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

interface ShopFormState {
  shopCode: string;
  posShopCode: string;
  name: string;
  address: string;
  phone: string;
  breakMinutes: 0 | 5 | 10 | 15;
  isActive: boolean;
}

// Tạo dữ liệu form từ shop đang sửa hoặc giá trị mặc định khi thêm mới.
function createShopFormState(shop: ShopUiModel | null): ShopFormState {
  return {
    shopCode: shop?.code ?? "",
    posShopCode: shop?.posCode ?? "",
    name: shop?.name ?? "",
    address: shop?.address ?? "",
    phone: shop?.phone ?? "",
    breakMinutes: shop?.therapistBreakMinutes ?? 0,
    isActive: shop?.isActive ?? true,
  };
}

// Quản lý form thêm/sửa shop, validation Zod, mutation và làm mới cache sau khi lưu.
function ShopForm({
  shop,
  onClose,
}: {
  shop: ShopUiModel | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => createShopFormState(shop));
  const createMutation = useCreateShop();
  const updateMutation = useUpdateShop(shop?.id ?? "");
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useAlert();
  const submitting = createMutation.isPending || updateMutation.isPending;

  // Chuẩn hóa dữ liệu giao diện về contract snake_case rồi gọi đúng mutation create hoặc update.
  const handleSubmit = async () => {
    try {
      if (shop) {
        const parsed = shopUpdateSchema.safeParse({
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          therapist_break_minutes: form.breakMinutes,
          is_active: form.isActive,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await updateMutation.mutateAsync(parsed.data);
      } else {
        const parsed = shopCreateSchema.safeParse({
          shop_code: form.shopCode.trim(),
          pos_shop_code: form.posShopCode.trim(),
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          therapist_break_minutes: form.breakMinutes,
          is_active: form.isActive,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await createMutation.mutateAsync(parsed.data);
      }
      await queryClient.invalidateQueries({ queryKey: ["shops"] });
      showSuccess(shop ? "Đã cập nhật shop." : "Đã tạo shop mới.");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu shop.");
    }
  };

  return (
    <AdminModal
      open
      title={shop ? "Chỉnh sửa shop" : "Thêm shop"}
      description="Mã hệ thống và mã POS dùng để đồng bộ dữ liệu giữa các hệ thống."
      submitting={submitting}
      submitLabel={shop ? "Lưu thay đổi" : "Tạo shop"}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label="Tên shop"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <AdminInput
          label="Mã shop"
          disabled={Boolean(shop)}
          value={form.shopCode}
          onChange={(event) => setForm((current) => ({ ...current, shopCode: event.target.value }))}
        />
        <AdminInput
          label="Mã POS"
          disabled={Boolean(shop)}
          value={form.posShopCode}
          onChange={(event) => setForm((current) => ({ ...current, posShopCode: event.target.value }))}
        />
        <AdminInput
          label="Số điện thoại"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        <AdminInput
          label="Địa chỉ"
          className="sm:col-span-2"
          value={form.address}
          onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
        />
        <AdminSelect
          label="Nghỉ giữa booking"
          value={String(form.breakMinutes)}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              breakMinutes: Number(event.target.value) as 0 | 5 | 10 | 15,
            }))
          }
        >
          {[0, 5, 10, 15].map((minutes) => (
            <option key={minutes} value={minutes}>{minutes} phút</option>
          ))}
        </AdminSelect>
        <AdminSelect
          label="Trạng thái"
          value={form.isActive ? "active" : "inactive"}
          onChange={(event) =>
            setForm((current) => ({ ...current, isActive: event.target.value === "active" }))
          }
        >
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm tắt</option>
        </AdminSelect>
      </div>
    </AdminModal>
  );
}

// Tải, lọc và trình bày danh sách shop dạng bảng desktop hoặc card mobile.
export function ShopList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; shop: ShopUiModel } | null>(null);
  const query = useShops(status === "all" ? undefined : status === "active");
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return query.data ?? [];
    return (query.data ?? []).filter((shop) =>
      [shop.name, shop.code, shop.posCode, shop.phone ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(keyword)),
    );
  }, [query.data, search]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 sm:flex-row sm:items-end">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-zinc-400" />
          <AdminInput
            label="Tìm kiếm"
            className="pl-9"
            placeholder="Tên, mã shop, mã POS hoặc số điện thoại"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <AdminSelect
          label="Trạng thái"
          className="sm:w-40"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Tất cả</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm tắt</option>
        </AdminSelect>
        <Button type="button" className="h-9 gap-2" onClick={() => setDialog({ mode: "create" })}>
          <Plus className="h-4 w-4" /> Thêm shop
        </Button>
      </div>

      <AdminDataState
        loading={query.isLoading}
        error={query.error}
        empty={filtered.length === 0}
        emptyMessage={search ? "Không tìm thấy shop phù hợp." : "Chưa có shop nào."}
      >
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Mã hệ thống</th>
                  <th className="px-4 py-3">Liên hệ</th>
                  <th className="px-4 py-3">Nghỉ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((shop) => (
                  <tr key={shop.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{shop.name}</p>
                      <p className="max-w-xs truncate text-xs text-zinc-500">{shop.address || "Chưa có địa chỉ"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      <p>{shop.code}</p><p>POS: {shop.posCode}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{shop.phone || "—"}</td>
                    <td className="px-4 py-3"><ShopBreakSelector shop={shop} /></td>
                    <td className="px-4 py-3"><ActiveBadge active={shop.isActive} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", shop })}>
                        <Pencil className="h-4 w-4" /> Sửa
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-zinc-100 md:hidden">
            {filtered.map((shop) => (
              <article key={shop.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-medium text-zinc-900">{shop.name}</h2>
                    <p className="mt-0.5 text-xs text-zinc-500">{shop.code} · POS {shop.posCode}</p>
                  </div>
                  <ActiveBadge active={shop.isActive} />
                </div>
                <p className="mt-2 truncate text-sm text-zinc-600">{shop.address || "Chưa có địa chỉ"}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <ShopBreakSelector shop={shop} />
                  <Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", shop })}>
                    <Pencil className="h-4 w-4" /> Sửa
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </AdminDataState>

      {dialog && (
        <ShopForm
          shop={dialog.mode === "edit" ? dialog.shop : null}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
