"use client";

import { LayoutDashboard, Building2 } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { PortalShell } from "@/components/layout/portal-shell";
import type { SidebarMenu } from "@/components/layout/sidebar";

const menuItems: SidebarMenu = [
  { label: "Dashboard", href: "/superadmin/dashboard", icon: LayoutDashboard },
  {
    label: "Yönetim",
    items: [
      { label: "Kurumlar", href: "/superadmin/institutions", icon: Building2 },
    ],
  },
];

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["superadmin"]}>
      <PortalShell menuItems={menuItems} portalTitle="Süper Yönetici">
        {children}
      </PortalShell>
    </AuthGuard>
  );
}
