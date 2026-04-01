"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { GraduationCap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
};

export type MenuGroup = {
  label: string;
  items: MenuItem[];
};

export type SidebarMenu = (MenuItem | MenuGroup)[];

function isMenuGroup(item: MenuItem | MenuGroup): item is MenuGroup {
  return "items" in item;
}

type SidebarProps = {
  menuItems: SidebarMenu;
  portalTitle: string;
  open: boolean;
  onClose: () => void;
};

function NavItem({
  item,
  pathname,
  onClose,
}: {
  item: MenuItem;
  pathname: string;
  onClose: () => void;
}) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive
            ? "text-accent-foreground"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({
  menuItems,
  portalTitle,
  open,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();

  const subtitle = user?.institution_name ?? portalTitle;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="border-border flex h-14 items-center gap-2.5 border-b px-4">
        <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
          <GraduationCap className="text-primary-foreground h-4 w-4" />
        </div>
        <div className="min-w-0">
          <span className="text-foreground text-sm font-semibold">
            Etüt Pro
          </span>
          <p className="text-muted-foreground truncate text-[11px] leading-none">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-4">
          {menuItems.map((entry) => {
            if (isMenuGroup(entry)) {
              const visibleItems = entry.items.filter(
                (item) => !item.permission || hasPermission(item.permission),
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={entry.label}>
                  <p className="text-muted-foreground mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider uppercase">
                    {entry.label}
                  </p>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => (
                      <NavItem
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            if (entry.permission && !hasPermission(entry.permission))
              return null;
            return (
              <NavItem
                key={entry.href}
                item={entry}
                pathname={pathname}
                onClose={onClose}
              />
            );
          })}
        </div>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="border-border bg-background hidden w-60 shrink-0 border-r lg:flex lg:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile Overlay + Sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="bg-background fixed inset-y-0 left-0 z-50 flex w-64 flex-col shadow-lg lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
