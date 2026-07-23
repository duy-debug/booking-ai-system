import { CourseManager } from "@/features/course/CourseManager";
import { AdminPageHeader } from "@/shared/components/admin/AdminUi";

// Hiển thị màn hình quản lý course theo shop với đầy đủ bộ lọc và thao tác CRUD.
export default function AdminCoursesPage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader title="Quản lý course" description="Quản lý course chính, add-on, thời lượng, giá và trạng thái theo từng shop." />
      <CourseManager />
    </section>
  );
}
