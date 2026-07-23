"use client";

import { apiClient, useApiListQuery, useApiMutation } from "@/shared/hooks/api";
import type { UUID } from "@/shared/types/common";
import {
  restrictionApi,
  toRestrictionUiModel,
  type RestrictionCreateInput,
  type RestrictionResponse,
  type RestrictionUiModel,
  type RestrictionUpdateInput,
} from "./restriction.types";

// Tải danh sách hạn chế khách hàng và chuyển response sang model trình bày.
export function useRestrictions(filters?: { phone?: string; isActive?: boolean }) {
  return useApiListQuery<RestrictionResponse, RestrictionUiModel>(
    ["restrictions", filters?.phone, filters?.isActive],
    restrictionApi.list,
    { phone: filters?.phone, is_active: filters?.isActive },
    toRestrictionUiModel,
  );
}

// Tạo mutation thêm số điện thoại vào danh sách hạn chế.
export function useCreateRestriction() {
  return useApiMutation<RestrictionCreateInput, RestrictionResponse>((input) =>
    apiClient.post<RestrictionResponse>(restrictionApi.create, input),
  );
}

// Tạo mutation cập nhật lý do hoặc trạng thái của restriction theo ID.
export function useUpdateRestriction(id: UUID) {
  return useApiMutation<RestrictionUpdateInput, RestrictionResponse>((input) =>
    apiClient.patch<RestrictionResponse>(restrictionApi.update(id), input),
  );
}
