import { ShopList } from "@/features/shop/ShopList";
import { AdminPageHeader } from "@/shared/components/admin/AdminUi";

// Trình bày tiêu đề và danh sách chi nhánh dưới dạng bảng hoặc card responsive.
export default function AdminShopsPage() {
  return (
    <section className="mx-auto w-full max-w-7xl min-w-0">
      <AdminPageHeader title="Quản lý shop" description="Quản lý chi nhánh, mã đồng bộ, liên hệ và thời gian nghỉ giữa booking." />
      <ShopList />
    </section>
  );
}
