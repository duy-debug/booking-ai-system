import { RestrictionManager } from "@/features/restriction/RestrictionManager";
import { AdminPageHeader } from "@/shared/components/admin/AdminUi";

// Hiển thị màn hình quản lý khách hàng bị hạn chế quyền đặt booking.
export default function AdminRestrictionsPage() {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <AdminPageHeader title="Hạn chế khách hàng" description="Quản lý số điện thoại không được phép tạo booking và lý do hạn chế." />
      <RestrictionManager />
    </section>
  );
}
