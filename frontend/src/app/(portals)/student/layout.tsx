"use client";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  UserCheck,
  Megaphone,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { PortalShell } from "@/components/layout/portal-shell";
import type { SidebarMenu } from "@/components/layout/sidebar";

const menuItems: SidebarMenu = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
  {
    label: "Eğitim",
    items: [
      {
        label: "Ders Programım",
        href: "/student/schedule",
        icon: CalendarDays,
      },
      {
        label: "Ödevlerim",
        href: "/student/assignments",
        icon: ClipboardList,
      },
      {
        label: "Özel Dersler",
        href: "/student/private-lessons",
        icon: UserCheck,
      },
      {
        label: "Devamsızlık",
        href: "/student/attendance",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Bilgiler",
    items: [
      { label: "Duyurular", href: "/student/announcements", icon: Megaphone },
    ],
  },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["student"]}>
      <PortalShell menuItems={menuItems} portalTitle="Öğrenci Paneli">
        {children}
      </PortalShell>
    </AuthGuard>
  );
}
