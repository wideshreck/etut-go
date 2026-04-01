"use client";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Wallet,
  Megaphone,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { ChatWidget } from "@/components/chat/chat-widget";
import { PortalShell } from "@/components/layout/portal-shell";
import type { SidebarMenu } from "@/components/layout/sidebar";

const menuItems: SidebarMenu = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard },
  {
    label: "Takip",
    items: [
      {
        label: "Ders Programı",
        href: "/parent/schedule",
        icon: CalendarDays,
      },
      {
        label: "Ödevler",
        href: "/parent/assignments",
        icon: ClipboardList,
      },
      {
        label: "Devamsızlık",
        href: "/parent/attendance",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    label: "Bilgiler",
    items: [
      { label: "Ödemeler", href: "/parent/payments", icon: Wallet },
      { label: "Duyurular", href: "/parent/announcements", icon: Megaphone },
    ],
  },
];

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["parent"]}>
      <PortalShell menuItems={menuItems} portalTitle="Veli Paneli">
        {children}
      </PortalShell>
      <ChatWidget />
    </AuthGuard>
  );
}
