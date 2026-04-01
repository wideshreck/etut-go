"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Plus, Pencil, Layers, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Group = {
  id: string;
  name: string;
  grade_level: string;
  field: string | null;
  academic_year: string;
  max_capacity: number;
  classroom: string | null;
  advisor_id: string | null;
  advisor_name: string | null;
  status: string;
  institution_id: string;
  student_count: number;
  created_at: string;
  updated_at: string;
};

type Teacher = { id: string; full_name: string };

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GRADE_LEVELS = [
  "8. Sınıf",
  "9. Sınıf",
  "10. Sınıf",
  "11. Sınıf",
  "12. Sınıf",
  "Mezun",
];

const FIELDS = ["Sayısal", "Eşit Ağırlık", "Sözel", "Dil"];

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
  merged: "Birleştirildi",
};

const STATUS_VARIANTS: Record<string, "success" | "destructive" | "warning"> = {
  active: "success",
  passive: "destructive",
  merged: "warning",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  /* dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("basics");

  /* preview dialog */
  const [previewGroup, setPreviewGroup] = useState<Group | null>(null);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* form — tab 1 (basics) */
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [field, setField] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [classroom, setClassroom] = useState("");

  /* form — tab 2 (management) */
  const [maxCapacity, setMaxCapacity] = useState("30");
  const [advisorId, setAdvisorId] = useState("");
  const [status, setStatus] = useState("");

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchGroups = useCallback(() => {
    api
      .get<Group[]>("/api/v1/admin/groups")
      .then((data) => setGroups(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchTeachers = useCallback(() => {
    api
      .get<Teacher[]>("/api/v1/admin/teachers")
      .then((data) => setTeachers(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchTeachers();
  }, [fetchGroups, fetchTeachers]);

  /* ---------------------------------------------------------------- */
  /*  Dialog helpers                                                    */
  /* ---------------------------------------------------------------- */

  function resetForm() {
    setName("");
    setGradeLevel("");
    setField("");
    setAcademicYear("");
    setClassroom("");
    setMaxCapacity("30");
    setAdvisorId("");
    setStatus("");
    setActiveTab("basics");
  }

  function openCreate() {
    setEditingGroup(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(group: Group) {
    setEditingGroup(group);
    setName(group.name);
    setGradeLevel(group.grade_level);
    setField(group.field ?? "");
    setAcademicYear(group.academic_year);
    setClassroom(group.classroom ?? "");
    setMaxCapacity(String(group.max_capacity));
    setAdvisorId(group.advisor_id ?? "");
    setStatus(group.status);
    setActiveTab("basics");
    setDialogOpen(true);
  }

  /* ---------------------------------------------------------------- */
  /*  Submit create / edit                                              */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name,
      grade_level: gradeLevel,
      field: field || null,
      academic_year: academicYear,
      max_capacity: Number(maxCapacity),
      classroom: classroom || null,
      advisor_id: advisorId || null,
    };

    if (editingGroup) {
      payload.status = status || editingGroup.status;
    }

    try {
      if (editingGroup) {
        await api.put(`/api/v1/admin/groups/${editingGroup.id}`, payload);
        toast.success("Sınıf başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/groups", payload);
        toast.success("Sınıf başarıyla oluşturuldu");
      }
      setDialogOpen(false);
      resetForm();
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Delete                                                            */
  /* ---------------------------------------------------------------- */

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/groups/${deleteId}`);
      toast.success("Sınıf başarıyla silindi");
      setDeleteId(null);
      fetchGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
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
        <h1 className="text-foreground text-xl font-semibold sm:text-2xl">
          Sınıflar
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Sınıf Oluştur
            </Button>
          </DialogTrigger>

          {/* ---- Create / Edit Dialog ---- */}
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? "Sınıf Düzenle" : "Yeni Sınıf"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="basics" className="flex-1">
                    Temel Bilgiler
                  </TabsTrigger>
                  <TabsTrigger value="management" className="flex-1">
                    Yönetim
                  </TabsTrigger>
                </TabsList>

                {/* ======== Tab 1 — Temel Bilgiler ======== */}
                <TabsContent value="basics">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Sınıf Adı</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="12-A, LGS-Hızlandırma-B"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Kademe</Label>
                        <Select
                          value={gradeLevel}
                          onValueChange={setGradeLevel}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADE_LEVELS.map((gl) => (
                              <SelectItem key={gl} value={gl}>
                                {gl}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Alan</Label>
                        <Select value={field} onValueChange={setField}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin (isteğe bağlı)" />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELDS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Eğitim Sezonu</Label>
                        <Input
                          value={academicYear}
                          onChange={(e) => setAcademicYear(e.target.value)}
                          placeholder="2025-2026"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Varsayılan Derslik</Label>
                        <Input
                          value={classroom}
                          onChange={(e) => setClassroom(e.target.value)}
                          placeholder="B-201"
                        />
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                {/* ======== Tab 2 — Yönetim ======== */}
                <TabsContent value="management">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Kontenjan</Label>
                      <Input
                        type="number"
                        min={1}
                        value={maxCapacity}
                        onChange={(e) => setMaxCapacity(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Rehber Öğretmen</Label>
                      <Select value={advisorId} onValueChange={setAdvisorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seçin (isteğe bağlı)" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {editingGroup && (
                      <div className="space-y-2">
                        <Label>Durum</Label>
                        <Select value={status} onValueChange={setStatus}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(
                              ([val, label]) => (
                                <SelectItem key={val} value={val}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </motion.div>
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setDialogOpen(false)}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting
                    ? "Kaydediliyor..."
                    : editingGroup
                      ? "Güncelle"
                      : "Oluştur"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Henüz sınıf eklenmedi
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sınıf Adı</TableHead>
                  <TableHead>Kademe</TableHead>
                  <TableHead>Alan</TableHead>
                  <TableHead>Dönem</TableHead>
                  <TableHead>Kontenjan</TableHead>
                  <TableHead>Danışman</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-24">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g, i) => (
                  <motion.tr
                    key={g.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                    onClick={() => setPreviewGroup(g)}
                  >
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.grade_level}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.field || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.academic_year}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.student_count}/{g.max_capacity}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {g.advisor_name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[g.status] ?? "secondary"}>
                        {STATUS_LABELS[g.status] ?? g.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(g);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(g.id);
                          }}
                        >
                          <Trash2 className="text-muted-foreground hover:text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {groups.map((g, i) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card
                  className="hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => setPreviewGroup(g)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {g.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {g.grade_level}
                          {g.field ? ` — ${g.field}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={STATUS_VARIANTS[g.status] ?? "secondary"}
                        >
                          {STATUS_LABELS[g.status] ?? g.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(g);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(g.id);
                          }}
                        >
                          <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">
                        {g.academic_year}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {g.student_count}/{g.max_capacity} öğrenci
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={!!previewGroup}
        onOpenChange={(open) => !open && setPreviewGroup(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {previewGroup && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div>{previewGroup.name}</div>
                    <div className="text-muted-foreground text-sm font-normal">
                      {previewGroup.grade_level}
                      {previewGroup.field ? ` — ${previewGroup.field}` : ""}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Separator className="my-4" />

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <PreviewField label="Sınıf Adı" value={previewGroup.name} />
                  <PreviewField
                    label="Kademe"
                    value={previewGroup.grade_level}
                  />
                  <PreviewField label="Alan" value={previewGroup.field} />
                  <PreviewField
                    label="Dönem"
                    value={previewGroup.academic_year}
                  />
                  <PreviewField
                    label="Derslik"
                    value={previewGroup.classroom}
                  />
                  <PreviewField
                    label="Kontenjan"
                    value={`${previewGroup.student_count}/${previewGroup.max_capacity}`}
                  />
                  <PreviewField
                    label="Danışman"
                    value={previewGroup.advisor_name}
                  />
                  <PreviewField
                    label="Durum"
                    value={
                      STATUS_LABELS[previewGroup.status] ?? previewGroup.status
                    }
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPreviewGroup(null)}
                  className="w-full sm:w-auto"
                >
                  Kapat
                </Button>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const id = previewGroup.id;
                    setPreviewGroup(null);
                    setDeleteId(id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sil
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const g = previewGroup;
                    setPreviewGroup(null);
                    openEdit(g);
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
            Bu sınıf kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
          </p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDeleteId(null)}
            >
              İptal
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
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

function PreviewField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="text-foreground">{value || "-"}</p>
    </div>
  );
}
