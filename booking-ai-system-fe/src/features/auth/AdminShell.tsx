"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  LayoutDashboard,
  Store,
  BookOpen,
  UsersRound,
  CalendarRange,
  CalendarCheck2,
  UserRoundX,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const sidebarItems: SidebarItem[] = [
  { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
  { label: "Shop", href: "/admin/shops", icon: Store },
  { label: "Course", href: "/admin/courses", icon: BookOpen },
  { label: "Therapist", href: "/admin/therapists", icon: UsersRound },
  { label: "Ca làm việc", href: "/admin/shifts", icon: CalendarRange },
  { label: "Booking", href: "/admin/bookings", icon: CalendarCheck2 },
  { label: "Cấm khách", href: "/admin/restrictions", icon: UserRoundX },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  return (
    <div className="flex min-h-screen">
      <aside
        className={`${
          collapsed ? "w-14" : "w-48"
        } shrink-0 border-r border-zinc-200 bg-white flex flex-col transition-[width] duration-150`}
      >
        {user && (
          <>
            <div className="flex items-center justify-between px-3 h-12 border-b border-zinc-100">
              <Link
                href="/admin"
                className="flex items-center gap-2 overflow-hidden"
                title={collapsed ? "Booking Admin" : undefined}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                </div>
                {!collapsed && (
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    Booking Admin
                  </span>
                )}
              </Link>
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.8} />
                ) : (
                  <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" strokeWidth={1.8} />
                )}
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 px-2 py-2 flex-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    }`}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon
                      className="h-[18px] w-[18px] shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.8}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-zinc-100 px-2 py-2">
              {!collapsed && (
                <p className="px-1 text-xs text-zinc-400 truncate mb-1">{user.email}</p>
              )}
              <button
                onClick={() => signOut().then(() => router.replace("/login"))}
                className="flex items-center gap-3 w-full rounded-md px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50"
                title={collapsed ? "Đăng xuất" : undefined}
                aria-label={collapsed ? "Đăng xuất" : undefined}
              >
                <LogOut
                  className="h-[18px] w-[18px] shrink-0"
                  aria-hidden="true"
                  strokeWidth={1.8}
                />
                {!collapsed && <span>Đăng xuất</span>}
              </button>
            </div>
          </>
        )}
      </aside>
      <main className="relative flex-1 overflow-auto bg-zinc-50">
        {children}
        {(isLoading || !user) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white text-zinc-500">
            Đang tải...
          </div>
        )}
      </main>
    </div>
  );
}
