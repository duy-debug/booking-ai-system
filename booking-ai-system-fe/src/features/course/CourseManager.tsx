"use client";

import { useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  courseCreateSchema,
  courseUpdateSchema,
  type CourseUiModel,
} from "@/features/course/course.types";
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
} from "@/features/course/use-course-queries";
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
import type { CourseType, UUID } from "@/shared/types/common";

interface CourseFormState {
  posCode: string;
  name: string;
  durationMinutes: string;
  price: string;
  courseType: CourseType;
  isActive: boolean;
}

// Khởi tạo form course từ bản ghi cần chỉnh sửa hoặc dữ liệu mặc định hợp lệ.
function createCourseFormState(course: CourseUiModel | null): CourseFormState {
  return {
    posCode: course?.posCode ?? "",
    name: course?.name ?? "",
    durationMinutes: String(course?.durationMinutes ?? 60),
    price: String(course?.price ?? 0),
    courseType: course?.courseType ?? "main",
    isActive: course?.isActive ?? true,
  };
}

// Quản lý form tạo/cập nhật course và đồng bộ danh sách course của shop sau khi lưu.
function CourseForm({
  shopId,
  course,
  onClose,
}: {
  shopId: UUID;
  course: CourseUiModel | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => createCourseFormState(course));
  const createMutation = useCreateCourse(shopId);
  const updateMutation = useUpdateCourse(course?.id ?? "");
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useAlert();
  const submitting = createMutation.isPending || updateMutation.isPending;

  // Validate dữ liệu nhập, gọi API tương ứng và thông báo kết quả cho admin.
  const handleSubmit = async () => {
    try {
      const sharedFields = {
        name: form.name.trim(),
        duration_minutes: form.durationMinutes,
        price: form.price,
        course_type: form.courseType,
        is_active: form.isActive,
      };
      if (course) {
        const parsed = courseUpdateSchema.safeParse(sharedFields);
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await updateMutation.mutateAsync(parsed.data);
      } else {
        const parsed = courseCreateSchema.safeParse({
          pos_course_code: form.posCode.trim(),
          ...sharedFields,
        });
        if (!parsed.success) {
          showError(firstValidationMessage(parsed.error));
          return;
        }
        await createMutation.mutateAsync(parsed.data);
      }
      await queryClient.invalidateQueries({ queryKey: ["courses", shopId] });
      showSuccess(course ? "Đã cập nhật course." : "Đã tạo course mới.");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu course.");
    }
  };

  return (
    <AdminModal
      open
      title={course ? "Chỉnh sửa course" : "Thêm course"}
      description="Course chính quyết định dịch vụ; add-on được cộng thêm thời lượng và giá."
      submitting={submitting}
      submitLabel={course ? "Lưu thay đổi" : "Tạo course"}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput label="Tên course" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <AdminInput label="Mã POS" value={form.posCode} disabled={Boolean(course)} onChange={(event) => setForm((current) => ({ ...current, posCode: event.target.value }))} />
        <AdminInput label="Thời lượng (phút)" type="number" min={15} step={15} value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
        <AdminInput label="Giá" type="number" min={0} step={1000} value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
        <AdminSelect label="Loại course" value={form.courseType} onChange={(event) => setForm((current) => ({ ...current, courseType: event.target.value as CourseType }))}>
          <option value="main">Course chính</option>
          <option value="addon">Add-on</option>
        </AdminSelect>
        <AdminSelect label="Trạng thái" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}>
          <option value="active">Hoạt động</option>
          <option value="inactive">Tạm tắt</option>
        </AdminSelect>
      </div>
    </AdminModal>
  );
}

// Điều phối chọn shop, bộ lọc và CRUD course trên một màn hình responsive.
export function CourseManager() {
  const shopsQuery = useShops(true);
  const [shopId, setShopId] = useState<UUID>("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | CourseType>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; course: CourseUiModel } | null>(null);
  const activeShopId = shopId || shopsQuery.data?.[0]?.id || "";
  const coursesQuery = useCourses(activeShopId, {
    courseType: type === "all" ? undefined : type,
    isActive: status === "all" ? undefined : status === "active",
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return coursesQuery.data ?? [];
    return (coursesQuery.data ?? []).filter((course) =>
      [course.name, course.posCode].some((value) => value.toLocaleLowerCase().includes(keyword)),
    );
  }, [coursesQuery.data, search]);

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[220px_minmax(220px,1fr)_150px_150px_auto] lg:items-end">
        <AdminSelect label="Shop" value={activeShopId} disabled={shopsQuery.isLoading} onChange={(event) => setShopId(event.target.value)}>
          {(shopsQuery.data ?? []).map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
        </AdminSelect>
        <div className="relative">
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-zinc-400" />
          <AdminInput label="Tìm kiếm" className="pl-9" placeholder="Tên hoặc mã POS" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <AdminSelect label="Loại" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="all">Tất cả</option><option value="main">Course chính</option><option value="addon">Add-on</option>
        </AdminSelect>
        <AdminSelect label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">Tất cả</option><option value="active">Hoạt động</option><option value="inactive">Tạm tắt</option>
        </AdminSelect>
        <Button type="button" className="h-9 gap-2" disabled={!activeShopId} onClick={() => setDialog({ mode: "create" })}><Plus className="h-4 w-4" /> Thêm course</Button>
      </div>

      <AdminDataState loading={shopsQuery.isLoading || coursesQuery.isLoading} error={shopsQuery.error ?? coursesQuery.error} empty={filtered.length === 0} emptyMessage="Shop chưa có course phù hợp bộ lọc.">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Course</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Thời lượng</th><th className="px-4 py-3">Giá</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((course) => <tr key={course.id} className="hover:bg-zinc-50"><td className="px-4 py-3"><p className="font-medium text-zinc-900">{course.name}</p><p className="text-xs text-zinc-500">POS: {course.posCode}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${course.courseType === "main" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{course.courseType === "main" ? "Chính" : "Add-on"}</span></td><td className="px-4 py-3 text-zinc-600">{course.durationMinutes} phút</td><td className="px-4 py-3 font-medium text-zinc-700">{course.price.toLocaleString("vi-VN")}₫</td><td className="px-4 py-3"><ActiveBadge active={course.isActive} /></td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" className="h-8 gap-1 px-2" onClick={() => setDialog({ mode: "edit", course })}><Pencil className="h-4 w-4" /> Sửa</Button></td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-zinc-100 md:hidden">
            {filtered.map((course) => <article key={course.id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-medium text-zinc-900">{course.name}</h2><p className="text-xs text-zinc-500">{course.posCode}</p></div><ActiveBadge active={course.isActive} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-600"><span>{course.courseType === "main" ? "Course chính" : "Add-on"}</span><span className="text-right">{course.durationMinutes} phút</span><span className="font-medium text-zinc-800">{course.price.toLocaleString("vi-VN")}₫</span><Button type="button" variant="ghost" className="h-8 justify-self-end gap-1 px-2" onClick={() => setDialog({ mode: "edit", course })}><Pencil className="h-4 w-4" /> Sửa</Button></div></article>)}
          </div>
        </div>
      </AdminDataState>

      {!activeShopId && !shopsQuery.isLoading && <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500"><BookOpen className="mx-auto mb-2 h-8 w-8" />Hãy tạo shop trước khi quản lý course.</div>}
      {dialog && activeShopId && <CourseForm shopId={activeShopId} course={dialog.mode === "edit" ? dialog.course : null} onClose={() => setDialog(null)} />}
    </>
  );
}
