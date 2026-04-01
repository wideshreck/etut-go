"use client";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  Layers,
  ClipboardList,
  UserCheck,
  Megaphone,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { PortalShell } from "@/components/layout/portal-shell";
import type { SidebarMenu } from "@/components/layout/sidebar";

const menuItems: SidebarMenu = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
  {
    label: "Eğitim",
    items: [
      {
        label: "Ders Programım",
        href: "/teacher/schedule",
        icon: CalendarDays,
      },
      { label: "Yoklama", href: "/teacher/attendance", icon: ClipboardCheck },
      { label: "Sınıflarım", href: "/teacher/groups", icon: Layers },
      { label: "Ödevler", href: "/teacher/assignments", icon: ClipboardList },
    ],
  },
  {
    label: "Diğer",
    items: [
      {
        label: "Özel Dersler",
        href: "/teacher/private-lessons",
        icon: UserCheck,
      },
      {
        label: "Duyurular",
        href: "/teacher/announcements",
        icon: Megaphone,
      },
    ],
  },
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["teacher"]}>
      <PortalShell menuItems={menuItems} portalTitle="Öğretmen Paneli">
        {children}
      </PortalShell>
    </AuthGuard>
  );
}
