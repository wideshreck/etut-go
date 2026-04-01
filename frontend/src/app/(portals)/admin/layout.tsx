"use client";

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  CalendarDays,
  UserCheck,
  UserSearch,
  Wallet,
  Banknote,
  Receipt,
  BookOpenCheck,
  Megaphone,
  BarChart3,
  Shield,
  ScrollText,
  UserCog,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { Bot } from "lucide-react";
import { PortalShell } from "@/components/layout/portal-shell";
import type { SidebarMenu } from "@/components/layout/sidebar";

const menuItems: SidebarMenu = [
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  { label: "AI Asistan", href: "/admin/ai", icon: Bot },

  {
    label: "Akademik",
    items: [
      {
        label: "Öğretmenler",
        href: "/admin/teachers",
        icon: Users,
        permission: "teachers.view",
      },
      {
        label: "Öğrenciler",
        href: "/admin/students",
        icon: GraduationCap,
        permission: "students.view",
      },
      {
        label: "Branşlar",
        href: "/admin/subjects",
        icon: BookOpen,
        permission: "subjects.view",
      },
      {
        label: "Sınıflar",
        href: "/admin/groups",
        icon: Layers,
        permission: "groups.view",
      },
      {
        label: "Ders Programı",
        href: "/admin/schedules",
        icon: CalendarDays,
        permission: "schedules.view",
      },
      {
        label: "Özel Dersler",
        href: "/admin/private-lessons",
        icon: UserCheck,
        permission: "private_lessons.view",
      },
    ],
  },

  {
    label: "İşlemler",
    items: [
      {
        label: "Ön Kayıt",
        href: "/admin/leads",
        icon: UserSearch,
        permission: "leads.view",
      },
      {
        label: "Duyurular",
        href: "/admin/announcements",
        icon: Megaphone,
        permission: "announcements.view",
      },
    ],
  },

  {
    label: "Muhasebe",
    items: [
      {
        label: "Öğrenci Ödemeleri",
        href: "/admin/payments",
        icon: Wallet,
        permission: "payments.view",
      },
      {
        label: "Öğretmen Maaşları",
        href: "/admin/teacher-payments",
        icon: Banknote,
        permission: "teacher_payments.view",
      },
      {
        label: "Giderler",
        href: "/admin/expenses",
        icon: Receipt,
        permission: "expenses.view",
      },
      {
        label: "Kasa Defteri",
        href: "/admin/cash-ledger",
        icon: BookOpenCheck,
        permission: "cash_ledger.view",
      },
    ],
  },

  {
    label: "Yönetim",
    items: [
      {
        label: "Raporlar",
        href: "/admin/reports",
        icon: BarChart3,
        permission: "reports.view",
      },
      {
        label: "Yetki Yönetimi",
        href: "/admin/roles",
        icon: Shield,
        permission: "settings.manage",
      },
      {
        label: "Admin Kullanıcılar",
        href: "/admin/admin-users",
        icon: UserCog,
        permission: "settings.manage",
      },
      {
        label: "Denetim Kaydı",
        href: "/admin/audit-logs",
        icon: ScrollText,
        permission: "settings.manage",
      },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <PortalShell menuItems={menuItems} portalTitle="Kurum Yönetimi">
        {children}
      </PortalShell>
    </AuthGuard>
  );
}
