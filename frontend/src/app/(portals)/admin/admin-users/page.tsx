"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { UserCog, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  roles: { id: string; name: string }[];
  created_at: string;
};

type Role = {
  id: string;
  name: string;
  permissions: string[];
  user_count: number;
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  /* create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  /* role assignment dialog */
  const [roleDialogUser, setRoleDialogUser] = useState<AdminUser | null>(null);
  const [assignedRoleIds, setAssignedRoleIds] = useState<string[]>([]);
  const [assigningRoles, setAssigningRoles] = useState(false);

  /* search */
  const [searchQuery, setSearchQuery] = useState("");

  /* ---------------------------------------------------------------- */
  /*  Fetch                                                            */
  /* ---------------------------------------------------------------- */

  const fetchAdmins = useCallback(() => {
    api
      .get<AdminUser[]>("/api/v1/admin/admin-users")
      .then((data) => setAdmins(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchRoles = useCallback(() => {
    api
      .get<Role[]>("/api/v1/admin/roles")
      .then((data) => setRoles(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchRoles();
  }, [fetchAdmins, fetchRoles]);

  /* ---------------------------------------------------------------- */
  /*  Filtered list                                                     */
  /* ---------------------------------------------------------------- */

  const filteredAdmins = admins.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  });

  /* ---------------------------------------------------------------- */
  /*  Create admin                                                      */
  /* ---------------------------------------------------------------- */

  function resetCreateForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setSelectedRoleIds([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/admin/admin-users", {
        email,
        password,
        full_name: fullName,
        phone: phone || null,
        role_ids: selectedRoleIds,
      });
      toast.success("Admin kullanıcı başarıyla oluşturuldu");
      setCreateOpen(false);
      resetCreateForm();
      fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Role assignment                                                   */
  /* ---------------------------------------------------------------- */

  function openRoleDialog(user: AdminUser) {
    setRoleDialogUser(user);
    setAssignedRoleIds(user.roles.map((r) => r.id));
  }

  function toggleAssignedRole(roleId: string) {
    setAssignedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  }

  async function handleAssignRoles() {
    if (!roleDialogUser) return;
    setAssigningRoles(true);
    try {
      await api.put(`/api/v1/admin/admin-users/${roleDialogUser.id}/roles`, {
        role_ids: assignedRoleIds,
      });
      toast.success("Roller başarıyla güncellendi");
      setRoleDialogUser(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setAssigningRoles(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Role chip toggle for create form                                  */
  /* ---------------------------------------------------------------- */

  function toggleCreateRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-foreground flex items-center gap-2 text-xl font-semibold sm:text-2xl">
          <UserCog className="h-6 w-6" />
          Admin Kullanıcılar
        </h1>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            if (!open) resetCreateForm();
            setCreateOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Admin Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle>Yeni Admin Kullanıcı</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Ad Soyad</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Şifre</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                {/* Role selection chips */}
                <div className="space-y-2">
                  <Label>Rol Ataması</Label>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const isSelected = selectedRoleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => toggleCreateRole(role.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {role.name}
                          {isSelected && <X className="h-3 w-3" />}
                        </button>
                      );
                    })}
                    {roles.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        Henüz rol tanımlanmamış
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetCreateForm();
                      setCreateOpen(false);
                    }}
                  >
                    İptal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Oluşturuluyor..." : "Oluştur"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
        <Input
          placeholder="Ad veya e-posta ile ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      {filteredAdmins.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserCog className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                {searchQuery
                  ? "Arama sonucu bulunamadı"
                  : "Henüz admin kullanıcı eklenmedi"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Roller</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-28">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin, i) => (
                  <motion.tr
                    key={admin.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                  >
                    <TableCell className="font-medium">
                      {admin.full_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {admin.roles.length > 0 ? (
                          admin.roles.map((role) => (
                            <Badge key={role.id} variant="secondary">
                              {role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Rol atanmamış
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={admin.is_active ? "success" : "destructive"}
                      >
                        {admin.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRoleDialog(admin)}
                      >
                        Rol Ata
                      </Button>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {filteredAdmins.map((admin, i) => (
              <motion.div
                key={admin.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                          {admin.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {admin.full_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {admin.email}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={admin.is_active ? "success" : "destructive"}
                      >
                        {admin.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {admin.roles.length > 0 ? (
                        admin.roles.map((role) => (
                          <Badge key={role.id} variant="secondary">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Rol atanmamış
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => openRoleDialog(admin)}
                      >
                        Rol Ata
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Role Assignment Dialog */}
      <Dialog
        open={!!roleDialogUser}
        onOpenChange={(open) => !open && setRoleDialogUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          {roleDialogUser && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle>Rol Ataması</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-sm">
                <span className="text-foreground font-medium">
                  {roleDialogUser.full_name}
                </span>{" "}
                kullanıcısı için rolleri seçin:
              </p>
              <div className="mt-4 space-y-2">
                {roles.map((role) => {
                  const isChecked = assignedRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className="border-input hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAssignedRole(role.id)}
                        className="border-input rounded"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm font-medium">
                          {role.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {role.permissions.length} yetki
                        </p>
                      </div>
                    </label>
                  );
                })}
                {roles.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    Henüz rol tanımlanmamış
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRoleDialogUser(null)}
                >
                  İptal
                </Button>
                <Button onClick={handleAssignRoles} disabled={assigningRoles}>
                  {assigningRoles ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
