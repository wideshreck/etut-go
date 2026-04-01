"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, KeyRound, LogOut, Menu } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type HeaderProps = { onMenuClick: () => void };

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ---- Notification state ---- */
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  /* ---- Password change state ---- */
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  /* ---- Fetch unread count on mount and every 30 seconds ---- */
  useEffect(() => {
    function fetchCount() {
      api
        .get<{ count: number }>("/api/v1/notifications/unread-count")
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Fetch notifications when bell clicked ---- */
  function openNotifications() {
    setNotifOpen(true);
    api
      .get<Notification[]>("/api/v1/notifications?limit=10")
      .then(setNotifications)
      .catch(() => {});
  }

  /* ---- Mark all as read ---- */
  async function markAllRead() {
    await api.put("/api/v1/notifications/read-all", {});
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  /* ---- Click outside to close notifications ---- */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  /* ---- Password change handler ---- */
  async function handleChangePassword() {
    setChangingPassword(true);
    try {
      await api.put("/api/v1/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Şifre başarıyla değiştirildi");
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setMenuOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setChangingPassword(false);
    }
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="border-border bg-background flex h-14 shrink-0 items-center justify-between border-b px-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Sağ: Notifications + User Menu */}
      <div className="ml-auto flex items-center gap-1">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotifications}
            className="text-muted-foreground hover:bg-muted hover:text-foreground relative rounded-lg p-2 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="border-border bg-background absolute top-full right-0 z-50 mt-1 w-80 rounded-lg border shadow-lg"
              >
                <div className="border-border flex items-center justify-between border-b px-4 py-2.5">
                  <span className="text-foreground text-sm font-medium">
                    Bildirimler
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-primary text-xs hover:underline"
                    >
                      Tümünü okundu işaretle
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center text-sm">
                      Bildirim yok
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "border-border border-b px-4 py-3 transition-colors last:border-0",
                          !n.is_read && "bg-accent/30",
                        )}
                      >
                        <p className="text-foreground text-sm font-medium">
                          {n.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {n.message}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          {new Date(n.created_at).toLocaleString("tr-TR")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="hover:bg-muted flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="hidden text-right md:block">
              <p className="text-foreground text-sm leading-none font-medium">
                {user?.full_name}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-none capitalize">
                {user?.role === "superadmin"
                  ? "Süper Yönetici"
                  : user?.role === "admin"
                    ? "Yönetici"
                    : user?.role === "teacher"
                      ? "Öğretmen"
                      : user?.role === "parent"
                        ? "Veli"
                        : "Öğrenci"}
              </p>
            </div>
            <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium">
              {initials}
            </div>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="border-border bg-background absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border p-1 shadow-lg"
              >
                {/* User info */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {user?.full_name}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <Separator className="my-1" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordOpen(true);
                  }}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  Şifre Değiştir
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Şifre Değiştir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mevcut Şifre</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Yeni Şifre</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setPasswordOpen(false)}
              >
                İptal
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword}
              >
                {changingPassword ? "Değiştiriliyor..." : "Değiştir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
