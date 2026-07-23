"use client";

import { X } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Button } from "@/shared/components/ui/button";

const controlClass =
  "h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:text-zinc-500";

// Hiển thị tiêu đề, mô tả và vùng hành động thống nhất cho các trang quản trị.
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

// Hiển thị badge trạng thái với màu sắc dùng chung và cho phép feature tùy chỉnh nhãn nghiệp vụ.
export function ActiveBadge({
  active,
  activeLabel = "Hoạt động",
  inactiveLabel = "Tạm tắt",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-zinc-100 text-zinc-600 ring-zinc-200"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

// Chuẩn hóa trạng thái tải, lỗi và danh sách rỗng để các feature không lặp markup.
export function AdminDataState({
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  loading: boolean;
  error?: Error | null;
  empty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-label="Đang tải dữ liệu">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-lg border border-zinc-200 bg-white"
          />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Không thể tải dữ liệu: {error.message}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }
  return children;
}

// Render input có label và giữ nguyên toàn bộ thuộc tính native cần cho form.
export function AdminInput({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <input className={`${controlClass} ${className}`} {...props} />
    </label>
  );
}

// Render select có label để bộ lọc và form dùng cùng kích thước, focus state.
export function AdminSelect({
  label,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <select className={`${controlClass} ${className}`} {...props}>
        {children}
      </select>
    </label>
  );
}

// Render textarea có label cho các trường mô tả hoặc lý do nhiều dòng.
export function AdminTextarea({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      <textarea
        className={`min-h-24 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
        {...props}
      />
    </label>
  );
}

// Hiển thị modal form dùng chung, khóa cuộn trong modal và cung cấp footer hành động rõ ràng.
export function AdminModal({
  open,
  title,
  description,
  submitting,
  submitLabel,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitting: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-zinc-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3">
          <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" loading={submitting} onClick={onSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Chuyển giá trị ngày giờ ISO thành chuỗi ngắn phù hợp giao diện quản trị Việt Nam.
export function formatAdminDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

// Chuyển lỗi Zod đầu tiên thành nội dung ngắn để hiển thị qua alert toàn cục.
export function firstValidationMessage(error: {
  issues: Array<{ message: string }>;
}): string {
  return error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.";
}
