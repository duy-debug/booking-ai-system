import { redirect } from "next/navigation";

// Chuyển route gốc sang màn hình đăng nhập, không render thêm giao diện trung gian.
export default function Home() {
  redirect("/login");
}
