import { TherapistManager } from "@/features/therapist/TherapistManager";
import { AdminPageHeader } from "@/shared/components/admin/AdminUi";

// Hiển thị màn hình quản lý therapist theo shop và trạng thái hoạt động.
export default function AdminTherapistsPage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader title="Quản lý therapist" description="Quản lý nhân viên, mã POS, giới tính và trạng thái làm việc theo từng shop." />
      <TherapistManager />
    </section>
  );
}
