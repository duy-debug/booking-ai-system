import { AdminDashboard } from "@/features/dashboard/AdminDashboard";
import { AdminPageHeader } from "@/shared/components/admin/AdminUi";

// Hiển thị thống kê shop và lối tắt tới toàn bộ phân hệ quản trị.
export default function AdminHomePage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader title="Tổng quan" description="Theo dõi nhanh cấu hình hệ thống và truy cập các phân hệ quản trị." />
      <AdminDashboard />
    </section>
  );
}
