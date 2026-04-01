"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

type AdminRole = {
  id: string;
  name: string;
  permissions: string[];
  user_count: number;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PERMISSION_GROUPS: Record<
  string,
  { label: string; permissions: { key: string; label: string }[] }
> = {
  dashboard: {
    label: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "Görüntüleme" }],
  },
  teachers: {
    label: "Öğretmenler",
    permissions: [
      { key: "teachers.view", label: "Görüntüleme" },
      { key: "teachers.create", label: "Ekleme" },
      { key: "teachers.edit", label: "Düzenleme" },
      { key: "teachers.delete", label: "Silme" },
    ],
  },
  students: {
    label: "Öğrenciler",
    permissions: [
      { key: "students.view", label: "Görüntüleme" },
      { key: "students.create", label: "Ekleme" },
      { key: "students.edit", label: "Düzenleme" },
      { key: "students.delete", label: "Silme" },
    ],
  },
  subjects: {
    label: "Branşlar",
    permissions: [
      { key: "subjects.view", label: "Görüntüleme" },
      { key: "subjects.create", label: "Ekleme" },
      { key: "subjects.edit", label: "Düzenleme" },
      { key: "subjects.delete", label: "Silme" },
    ],
  },
  groups: {
    label: "Sınıflar",
    permissions: [
      { key: "groups.view", label: "Görüntüleme" },
      { key: "groups.create", label: "Ekleme" },
      { key: "groups.edit", label: "Düzenleme" },
      { key: "groups.delete", label: "Silme" },
    ],
  },
  schedules: {
    label: "Ders Programı",
    permissions: [
      { key: "schedules.view", label: "Görüntüleme" },
      { key: "schedules.create", label: "Ekleme" },
      { key: "schedules.edit", label: "Düzenleme" },
      { key: "schedules.delete", label: "Silme" },
    ],
  },
  payments: {
    label: "Ödemeler",
    permissions: [
      { key: "payments.view", label: "Görüntüleme" },
      { key: "payments.create", label: "Ekleme" },
      { key: "payments.edit", label: "Düzenleme" },
      { key: "payments.delete", label: "Silme" },
    ],
  },
  announcements: {
    label: "Duyurular",
    permissions: [
      { key: "announcements.view", label: "Görüntüleme" },
      { key: "announcements.create", label: "Ekleme" },
      { key: "announcements.edit", label: "Düzenleme" },
      { key: "announcements.delete", label: "Silme" },
    ],
  },
  attendance: {
    label: "Yoklama",
    permissions: [
      { key: "attendance.view", label: "Görüntüleme" },
      { key: "attendance.create", label: "Yoklama Alma" },
    ],
  },
  leads: {
    label: "Ön Kayıt",
    permissions: [
      { key: "leads.view", label: "Görüntüleme" },
      { key: "leads.create", label: "Ekleme" },
      { key: "leads.edit", label: "Düzenleme" },
      { key: "leads.delete", label: "Silme" },
      { key: "leads.convert", label: "Dönüştürme" },
    ],
  },
  reports: {
    label: "Raporlar",
    permissions: [{ key: "reports.view", label: "Görüntüleme" }],
  },
  settings: {
    label: "Ayarlar",
    permissions: [{ key: "settings.manage", label: "Yönetme" }],
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function RolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* form state */
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  /* edit state */
  const [editingId, setEditingId] = useState<string | null>(null);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(() => {
    api
      .get<AdminRole[]>("/api/v1/admin/roles")
      .then((data) => setRoles(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  /* ------ helpers ------ */

  function resetForm() {
    setRoleName("");
    setSelectedPermissions([]);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(role: AdminRole) {
    setRoleName(role.name);
    setSelectedPermissions([...role.permissions]);
    setEditingId(role.id);
    setShowForm(true);
  }

  function togglePermission(key: string) {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  function isGroupAllSelected(groupKey: string): boolean {
    const group = PERMISSION_GROUPS[groupKey];
    if (!group) return false;
    return group.permissions.every((p) => selectedPermissions.includes(p.key));
  }

  function toggleGroupAll(groupKey: string) {
    const group = PERMISSION_GROUPS[groupKey];
    if (!group) return;
    const allKeys = group.permissions.map((p) => p.key);
    if (isGroupAllSelected(groupKey)) {
      setSelectedPermissions((prev) =>
        prev.filter((p) => !allKeys.includes(p)),
      );
    } else {
      setSelectedPermissions((prev) => [
        ...prev,
        ...allKeys.filter((k) => !prev.includes(k)),
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: roleName,
        permissions: selectedPermissions,
      };

      if (editingId) {
        await api.put(`/api/v1/admin/roles/${editingId}`, payload);
        toast.success("Rol başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/roles", payload);
        toast.success("Rol başarıyla oluşturuldu");
      }
      resetForm();
      setShowForm(false);
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/roles/${deleteId}`);
      toast.success("Rol başarıyla silindi");
      setDeleteId(null);
      fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
          <Shield className="h-6 w-6" />
          Yetki Yönetimi
        </h1>
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setShowForm(open);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Rol Oluştur
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Rolü Düzenle" : "Yeni Rol Oluştur"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Rol Adı</Label>
                  <Input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    placeholder="Örn: Müdür Yardımcısı"
                    required
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-sm font-medium">Yetkiler</Label>
                  {Object.entries(PERMISSION_GROUPS).map(
                    ([groupKey, group], gi) => (
                      <motion.div
                        key={groupKey}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.04, duration: 0.2 }}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            {group.label}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleGroupAll(groupKey)}
                            className="text-muted-foreground text-xs"
                          >
                            {isGroupAllSelected(groupKey)
                              ? "Kaldır"
                              : "Tümünü Seç"}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {group.permissions.map((perm) => (
                            <label
                              key={perm.key}
                              className="border-input hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                                className="border-input rounded"
                              />
                              <span className="text-xs">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                        <Separator />
                      </motion.div>
                    ),
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                  >
                    İptal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting
                      ? "Kaydediliyor..."
                      : editingId
                        ? "Güncelle"
                        : "Oluştur"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role list */}
      {roles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Shield className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground mt-4 text-sm">
            Henüz rol tanımlanmamış
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role, i) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Card className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground text-sm font-semibold">
                        {role.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {role.user_count} kullanıcı
                        </Badge>
                        <Badge variant="outline">
                          {role.permissions.length} yetki
                        </Badge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteId(role.id)}
                      >
                        <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Silme Onayı</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Bu rol kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Siliniyor..." : "Sil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
