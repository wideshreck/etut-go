"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Eye,
  Trash2,
  GraduationCap,
  Users,
  Loader2,
  UserPlus,
} from "lucide-react";

type Institution = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  tax_office: string | null;
  tax_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type InstitutionStat = {
  id: string;
  name: string;
  is_active: boolean;
  student_count: number;
  teacher_count: number;
};

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [stats, setStats] = useState<InstitutionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog states
  const [showForm, setShowForm] = useState(false);
  const [editingInst, setEditingInst] = useState<Institution | null>(null);
  const [previewInst, setPreviewInst] = useState<Institution | null>(null);
  const [deleteInst, setDeleteInst] = useState<Institution | null>(null);
  const [adminInst, setAdminInst] = useState<Institution | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [submitting, setSubmitting] = useState(false);

  // Admin form fields
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const statsMap = useMemo(() => {
    const map = new Map<string, InstitutionStat>();
    stats.forEach((s) => map.set(s.id, s));
    return map;
  }, [stats]);

  const filteredInstitutions = useMemo(() => {
    if (!search.trim()) return institutions;
    const q = search.toLowerCase();
    return institutions.filter((inst) => inst.name.toLowerCase().includes(q));
  }, [institutions, search]);

  function fetchData() {
    Promise.all([
      api.get<Institution[]>("/api/v1/superadmin/institutions"),
      api.get<InstitutionStat[]>("/api/v1/superadmin/dashboard"),
    ])
      .then(([instData, statsData]) => {
        setInstitutions(instData ?? []);
        setStats(statsData ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  function resetForm() {
    setName("");
    setAddress("");
    setPhone("");
    setTaxOffice("");
    setTaxNumber("");
    setIsActive("true");
  }

  function openCreate() {
    resetForm();
    setEditingInst(null);
    setShowForm(true);
  }

  function openEdit(inst: Institution) {
    setName(inst.name);
    setAddress(inst.address ?? "");
    setPhone(inst.phone ?? "");
    setTaxOffice(inst.tax_office ?? "");
    setTaxNumber(inst.tax_number ?? "");
    setIsActive(inst.is_active ? "true" : "false");
    setEditingInst(inst);
    setShowForm(true);
  }

  function openPreview(inst: Institution) {
    setPreviewInst(inst);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingInst) {
        await api.put(`/api/v1/superadmin/institutions/${editingInst.id}`, {
          name,
          address: address || null,
          phone: phone || null,
          tax_office: taxOffice || null,
          tax_number: taxNumber || null,
          is_active: isActive === "true",
        });
        toast.success("Kurum başarıyla güncellendi");
      } else {
        await api.post("/api/v1/superadmin/institutions", {
          name,
          address: address || null,
          phone: phone || null,
          tax_office: taxOffice || null,
          tax_number: taxNumber || null,
        });
        toast.success("Kurum başarıyla oluşturuldu");
      }
      setShowForm(false);
      resetForm();
      setEditingInst(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteInst) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/superadmin/institutions/${deleteInst.id}`);
      toast.success("Kurum başarıyla silindi");
      setDeleteInst(null);
      setPreviewInst(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  }

  async function handleAssignAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminInst) return;
    setAdminSubmitting(true);
    try {
      await api.post(`/api/v1/superadmin/institutions/${adminInst.id}/admin`, {
        email: adminEmail,
        password: adminPassword,
        full_name: adminFullName,
      });
      toast.success(`Admin atandı. Geçici şifre: ${adminPassword}`, {
        duration: 8000,
      });
      setAdminEmail("");
      setAdminPassword("");
      setAdminFullName("");
      setAdminInst(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setAdminSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold">Kurumlar</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Kurum Ekle
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Kurum ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Institution Cards Grid */}
      {filteredInstitutions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="text-muted-foreground/50 h-12 w-12" />
              <p className="text-muted-foreground mt-4 text-sm font-medium">
                {search
                  ? "Aramanızla eşleşen kurum bulunamadı"
                  : "Henüz kurum eklenmedi"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredInstitutions.map((inst, i) => {
            const stat = statsMap.get(inst.id);
            return (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card className="hover:border-primary/30 transition-all hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                          <Building2 className="text-primary h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-foreground text-sm font-semibold">
                            {inst.name}
                          </h3>
                          {inst.address && (
                            <p className="text-muted-foreground text-xs">
                              {inst.address}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={inst.is_active ? "success" : "destructive"}
                      >
                        {inst.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </div>

                    <Separator className="my-3" />

                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5" />
                          {stat?.student_count ?? 0} öğrenci
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {stat?.teacher_count ?? 0} öğretmen
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(inst)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openPreview(inst)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingInst(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingInst ? "Kurumu Düzenle" : "Yeni Kurum"}
              </DialogTitle>
              <DialogDescription>
                {editingInst
                  ? "Kurum bilgilerini güncelleyin."
                  : "Yeni bir kurum oluşturun."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Kurum Adı</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kurum adını girin"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Adres</Label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Kurum adresi"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Telefon numarası"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vergi Dairesi</Label>
                  <Input
                    value={taxOffice}
                    onChange={(e) => setTaxOffice(e.target.value)}
                    placeholder="Örn: Üsküdar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vergi Kimlik No (VKN)</Label>
                  <Input
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="10 haneli VKN"
                    maxLength={11}
                  />
                </div>
              </div>
              {editingInst && (
                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select value={isActive} onValueChange={setIsActive}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktif</SelectItem>
                      <SelectItem value="false">Pasif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setShowForm(false);
                    setEditingInst(null);
                    resetForm();
                  }}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingInst ? "Güncelle" : "Oluştur"}
                </Button>
              </div>
            </form>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={previewInst !== null}
        onOpenChange={(open) => !open && setPreviewInst(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {previewInst && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                    <Building2 className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle>{previewInst.name}</DialogTitle>
                    <p className="text-muted-foreground text-xs">
                      Kurum Detayları
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Ad
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {previewInst.name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Durum
                  </p>
                  <div className="mt-0.5">
                    <Badge
                      variant={
                        previewInst.is_active ? "success" : "destructive"
                      }
                    >
                      {previewInst.is_active ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Adres
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {previewInst.address || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Telefon
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {previewInst.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Vergi Dairesi
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {previewInst.tax_office || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    VKN
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {previewInst.tax_number || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Öğrenci Sayısı
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {statsMap.get(previewInst.id)?.student_count ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium">
                    Öğretmen Sayısı
                  </p>
                  <p className="text-foreground mt-0.5 text-sm">
                    {statsMap.get(previewInst.id)?.teacher_count ?? 0}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Admin Management Section */}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-sm font-medium">
                    Admin Yönetimi
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAdminInst(previewInst);
                    }}
                  >
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Admin Ata
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Footer */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setPreviewInst(null)}
                >
                  Kapat
                </Button>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setDeleteInst(previewInst)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sil
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    openEdit(previewInst);
                    setPreviewInst(null);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Düzenle
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Assignment Dialog */}
      <Dialog
        open={adminInst !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdminInst(null);
            setAdminEmail("");
            setAdminPassword("");
            setAdminFullName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {adminInst && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle>Admin Ata</DialogTitle>
                <DialogDescription>
                  {adminInst.name} kurumuna admin atayın.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAssignAdmin} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>E-posta</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@kurum.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Şifre</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Geçici şifre"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ad Soyad</Label>
                  <Input
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Admin adı soyadı"
                    required
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setAdminInst(null);
                      setAdminEmail("");
                      setAdminPassword("");
                      setAdminFullName("");
                    }}
                  >
                    İptal
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={adminSubmitting}
                  >
                    {adminSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Ata
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteInst !== null}
        onOpenChange={(open) => !open && setDeleteInst(null)}
      >
        <DialogContent className="sm:max-w-md">
          {deleteInst && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle>Kurumu Sil</DialogTitle>
                <DialogDescription>
                  <strong>{deleteInst.name}</strong> kurumunu silmek
                  istediğinize emin misiniz?
                </DialogDescription>
              </DialogHeader>
              <p className="text-destructive mt-2 text-sm">
                Bu kurum ve tüm verileri kalıcı olarak silinecektir.
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setDeleteInst(null)}
                >
                  İptal
                </Button>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sil
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
