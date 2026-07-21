// Múi giờ của shop — backend KHÔNG chuẩn hóa múi giờ, frontend phải tự xử lý.
// Căn cứ: app/db/models/booking.py (start_time/end_time là TIME naive),
//         docs/frontend-analysis.md §6.7, §9.
import { env } from "@/shared/config/env";

export const SHOP_TIMEZONE = env.shopTimezone;

// Dải giờ bắt đầu có thể chọn trong form. 24:00 là mốc cuối ngày, không phải
// một start_time hợp lệ, nên option cuối cùng theo bước 15 phút là 23:45.
export const BUSINESS_HOURS = {
  open: "00:00",
  close: "23:45",
} as const;
