import { z } from "zod";
import type { UUID } from "@/shared/types/common";

export const restrictionCreateSchema = z.object({
  phone: z.string().trim().min(8, "Số điện thoại phải có ít nhất 8 ký tự"),
  reason: z.string().trim().max(500, "Lý do tối đa 500 ký tự").optional(),
  is_active: z.boolean().default(true),
});
export type RestrictionCreateInput = z.infer<typeof restrictionCreateSchema>;

export const restrictionUpdateSchema = restrictionCreateSchema
  .omit({ phone: true })
  .partial();
export type RestrictionUpdateInput = z.infer<typeof restrictionUpdateSchema>;

export interface RestrictionResponse {
  restriction_id: UUID;
  phone: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestrictionUiModel {
  id: UUID;
  phone: string;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Ánh xạ restriction DTO từ backend sang model camelCase dành riêng cho giao diện.
export function toRestrictionUiModel(dto: RestrictionResponse): RestrictionUiModel {
  return {
    id: dto.restriction_id,
    phone: dto.phone,
    reason: dto.reason,
    isActive: dto.is_active,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export const restrictionApi = {
  list: "/api/admin/customer-restrictions",
  create: "/api/admin/customer-restrictions",
  update: (id: UUID) => `/api/admin/customer-restrictions/${id}`,
};
