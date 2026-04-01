"use client";

import { useState } from "react";
import { Sidebar, type SidebarMenu } from "./sidebar";
import { Header } from "./header";

type PortalShellProps = {
  children: React.ReactNode;
  menuItems: SidebarMenu;
  portalTitle: string;
};

export function PortalShell({
  children,
  menuItems,
  portalTitle,
}: PortalShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        menuItems={menuItems}
        portalTitle={portalTitle}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="bg-muted flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
