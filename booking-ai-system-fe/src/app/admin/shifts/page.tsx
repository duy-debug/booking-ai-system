import { ShiftManager } from "@/features/shift/ShiftManager";
import { AdminPageHeader } from "@/shared/components/admin/AdminUi";

// Hiển thị màn hình xếp và chỉnh sửa ca làm việc theo shop, ngày và therapist.
export default function AdminShiftsPage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader title="Quản lý ca làm việc" description="Xếp ca theo ngày, kiểm tra khung giờ và trạng thái hoạt động của therapist." />
      <ShiftManager />
    </section>
  );
}
