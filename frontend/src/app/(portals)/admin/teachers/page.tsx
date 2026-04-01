"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Pencil, Users, X, Trash2, Search, Upload } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { TimePicker } from "@/components/ui/time-picker";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { maskTC } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SubjectOption = { id: string; name: string };
type AvailabilityInfo = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
type Teacher = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  employment_type: string | null;
  start_date: string | null;
  university: string | null;
  department: string | null;
  salary_type: string | null;
  salary_amount: number | null;
  iban: string | null;
  tc_no: string | null;
  address: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  subject_id: string | null;
  subject_name: string | null;
  notes: string | null;
  availability: AvailabilityInfo[] | null;
};

type AvailabilityRow = {
  key: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAY_NAMES: Record<number, string> = {
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
  7: "Pazar",
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "Tam Zamanlı",
  part_time: "Yarı Zamanlı",
  weekend_only: "Hafta Sonu",
  hourly: "Saat Ücretli",
};

const SALARY_LABELS: Record<string, string> = {
  fixed: "Sabit Maaş",
  per_lesson: "Ders Başı",
};

/* ------------------------------------------------------------------ */
/*  Helper: unique key generator                                       */
/* ------------------------------------------------------------------ */

let _keyCounter = 0;
function nextKey() {
  _keyCounter += 1;
  return `avail-${_keyCounter}-${Date.now()}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  /* dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  /* preview dialog */
  const [previewTeacher, setPreviewTeacher] = useState<Teacher | null>(null);
  const [showTC, setShowTC] = useState(false);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* search & filter */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");

  /* form — tab 1 (general) */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [tcNo, setTcNo] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [notes, setNotes] = useState("");

  /* form — tab 2 (professional) */
  const [subjectId, setSubjectId] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>(
    [],
  );

  /* form — tab 3 (financial) */
  const [salaryType, setSalaryType] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [iban, setIban] = useState("");

  /* import dialog */
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    errors: string[];
  } | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Bulk import                                                      */
  /* ---------------------------------------------------------------- */

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const result = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/import/teachers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: formData,
        },
      );
      const data = await result.json();

      if (!result.ok) throw new Error(data.detail || "İçe aktarma başarısız");

      setImportResult(data);
      toast.success(`${data.created} öğretmen başarıyla içe aktarıldı`);
      if (data.created > 0) fetchTeachers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setImporting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchTeachers = useCallback((search?: string, subjectId?: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (subjectId && subjectId !== "all") params.set("subject_id", subjectId);
    const query = params.toString();
    api
      .get<Teacher[]>(`/api/v1/admin/teachers${query ? `?${query}` : ""}`)
      .then((data) => setTeachers(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchSubjects = useCallback(() => {
    api
      .get<SubjectOption[]>("/api/v1/admin/subjects")
      .then((data) => setAllSubjects(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
  }, [fetchTeachers, fetchSubjects]);

  /* debounced search & filters */
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTeachers(searchQuery, filterSubject);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, filterSubject, fetchTeachers]);

  /* ---------------------------------------------------------------- */
  /*  Dialog helpers                                                    */
  /* ---------------------------------------------------------------- */

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setTcNo("");
    setAddress("");
    setEmergencyContact("");
    setEmergencyPhone("");
    setNotes("");
    setSubjectId("");
    setEmploymentType("");
    setStartDate("");
    setUniversity("");
    setDepartment("");
    setAvailabilityRows([]);
    setSalaryType("");
    setSalaryAmount("");
    setIban("");
    setActiveTab("general");
  }

  function openCreate() {
    setEditingTeacher(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(teacher: Teacher) {
    setEditingTeacher(teacher);
    setFullName(teacher.full_name);
    setEmail(teacher.email);
    setPassword("");
    setPhone(teacher.phone ?? "");
    setTcNo(teacher.tc_no ?? "");
    setAddress(teacher.address ?? "");
    setEmergencyContact(teacher.emergency_contact ?? "");
    setEmergencyPhone(teacher.emergency_phone ?? "");
    setNotes(teacher.notes ?? "");
    setSubjectId(teacher.subject_id ?? "");
    setEmploymentType(teacher.employment_type ?? "");
    setStartDate(teacher.start_date ?? "");
    setUniversity(teacher.university ?? "");
    setDepartment(teacher.department ?? "");
    setAvailabilityRows(
      (teacher.availability ?? []).map((a) => ({
        key: nextKey(),
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
      })),
    );
    setSalaryType(teacher.salary_type ?? "");
    setSalaryAmount(
      teacher.salary_amount != null ? String(teacher.salary_amount) : "",
    );
    setIban(teacher.iban ?? "");
    setActiveTab("general");
    setDialogOpen(true);
  }

  /* ---------------------------------------------------------------- */
  /*  Availability helpers                                              */
  /* ---------------------------------------------------------------- */

  function addAvailabilityRow() {
    setAvailabilityRows((prev) => [
      ...prev,
      { key: nextKey(), day_of_week: 1, start_time: "", end_time: "" },
    ]);
  }

  function updateAvailabilityRow(
    key: string,
    field: keyof Omit<AvailabilityRow, "key">,
    value: string | number,
  ) {
    setAvailabilityRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function removeAvailabilityRow(key: string) {
    setAvailabilityRows((prev) => prev.filter((r) => r.key !== key));
  }

  /* ---------------------------------------------------------------- */
  /*  Submit                                                            */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      full_name: fullName,
      phone: phone || null,
      tc_no: tcNo || null,
      address: address || null,
      emergency_contact: emergencyContact || null,
      emergency_phone: emergencyPhone || null,
      notes: notes || null,
      subject_id: subjectId || null,
      employment_type: employmentType || null,
      start_date: startDate || null,
      university: university || null,
      department: department || null,
      salary_type: salaryType || null,
      salary_amount: salaryAmount ? Number(salaryAmount) : null,
      iban: iban || null,
      availability: availabilityRows.map((r) => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
      })),
    };

    try {
      if (editingTeacher) {
        await api.put(`/api/v1/admin/teachers/${editingTeacher.id}`, payload);
        toast.success("Öğretmen başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/teachers", {
          ...payload,
          email,
          password,
        });
        toast.success("Öğretmen başarıyla oluşturuldu");
      }
      setDialogOpen(false);
      resetForm();
      fetchTeachers();
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
      await api.delete(`/api/v1/admin/teachers/${deleteId}`);
      toast.success("Öğretmen başarıyla silindi");
      setDeleteId(null);
      fetchTeachers();
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
          Öğretmenler
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            İçe Aktar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <PermissionGate permission="teachers.create">
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Öğretmen Ekle
                </Button>
              </DialogTrigger>
            </PermissionGate>

            {/* ---- Create / Edit Dialog ---- */}
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTeacher ? "Öğretmen Düzenle" : "Yeni Öğretmen"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="general" className="flex-1">
                      Genel
                    </TabsTrigger>
                    <TabsTrigger value="professional" className="flex-1">
                      Profesyonel
                    </TabsTrigger>
                    <TabsTrigger value="financial" className="flex-1">
                      Finansal
                    </TabsTrigger>
                  </TabsList>

                  {/* ======== Tab 1 — Genel ======== */}
                  <TabsContent value="general">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label>Ad Soyad</Label>
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>

                      {!editingTeacher && (
                        <>
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
                        </>
                      )}

                      <div className="space-y-2">
                        <Label>Telefon</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>TC Kimlik No</Label>
                        <Input
                          value={tcNo}
                          onChange={(e) => setTcNo(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Adres</Label>
                        <Textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Acil Durum Kişisi</Label>
                          <Input
                            value={emergencyContact}
                            onChange={(e) =>
                              setEmergencyContact(e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Acil Durum Telefonu</Label>
                          <Input
                            value={emergencyPhone}
                            onChange={(e) => setEmergencyPhone(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Notlar</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Kurum içi notlar..."
                          rows={2}
                        />
                      </div>
                    </motion.div>
                  </TabsContent>

                  {/* ======== Tab 2 — Profesyonel ======== */}
                  <TabsContent value="professional">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Subject */}
                        <div className="space-y-2">
                          <Label>Branş</Label>
                          <Select
                            value={subjectId}
                            onValueChange={setSubjectId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {allSubjects.map((subj) => (
                                <SelectItem key={subj.id} value={subj.id}>
                                  {subj.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Çalışma Türü</Label>
                          <Select
                            value={employmentType}
                            onValueChange={setEmploymentType}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(EMPLOYMENT_LABELS).map(
                                ([val, label]) => (
                                  <SelectItem key={val} value={val}>
                                    {label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>İşe Başlama Tarihi</Label>
                          <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Üniversite</Label>
                          <Input
                            value={university}
                            onChange={(e) => setUniversity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Bölüm</Label>
                          <Input
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Availability */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Uygunluk Saatleri</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addAvailabilityRow}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Saat Ekle
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                            {availabilityRows.map((row) => (
                              <motion.div
                                key={row.key}
                                layout
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 16 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-2"
                              >
                                <Select
                                  value={String(row.day_of_week)}
                                  onValueChange={(v) =>
                                    updateAvailabilityRow(
                                      row.key,
                                      "day_of_week",
                                      Number(v),
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(DAY_NAMES).map(
                                      ([val, label]) => (
                                        <SelectItem key={val} value={val}>
                                          {label}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>

                                <TimePicker
                                  value={row.start_time}
                                  onChange={(v) =>
                                    updateAvailabilityRow(
                                      row.key,
                                      "start_time",
                                      v,
                                    )
                                  }
                                  placeholder="Başlangıç"
                                />

                                <TimePicker
                                  value={row.end_time}
                                  onChange={(v) =>
                                    updateAvailabilityRow(
                                      row.key,
                                      "end_time",
                                      v,
                                    )
                                  }
                                  placeholder="Bitiş"
                                />

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAvailabilityRow(row.key)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </motion.div>
                            ))}
                          </AnimatePresence>

                          {availabilityRows.length === 0 && (
                            <p className="text-muted-foreground text-sm">
                              Henüz uygunluk saati eklenmedi
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </TabsContent>

                  {/* ======== Tab 3 — Finansal ======== */}
                  <TabsContent value="financial">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label>Ücret Tipi</Label>
                        <Select
                          value={salaryType}
                          onValueChange={setSalaryType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SALARY_LABELS).map(
                              ([val, label]) => (
                                <SelectItem key={val} value={val}>
                                  {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Ücret Tutarı</Label>
                        <div className="relative">
                          <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                            ₺
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={salaryAmount}
                            onChange={(e) => setSalaryAmount(e.target.value)}
                            className="pl-7"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>IBAN</Label>
                        <Input
                          value={iban}
                          onChange={(e) => setIban(e.target.value)}
                          placeholder="TR..."
                        />
                      </div>
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
                      : editingTeacher
                        ? "Güncelle"
                        : "Oluştur"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Ad, e-posta veya telefon ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Branşlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Branşlar</SelectItem>
            {allSubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {teachers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                Henüz öğretmen eklenmedi
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
                  <TableHead>Branş</TableHead>
                  <TableHead>Çalışma Türü</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-20">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t, i) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                    onClick={() => setPreviewTeacher(t)}
                  >
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.subject_name ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.employment_type
                        ? (EMPLOYMENT_LABELS[t.employment_type] ??
                          t.employment_type)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.is_active ? "success" : "destructive"}>
                        {t.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <PermissionGate permission="teachers.edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(t);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="teachers.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(t.id);
                            }}
                          >
                            <Trash2 className="text-muted-foreground hover:text-destructive h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Card List */}
          <div className="space-y-3 md:hidden">
            {teachers.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card
                  className="hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => setPreviewTeacher(t)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                          {t.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {t.full_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {t.employment_type
                              ? (EMPLOYMENT_LABELS[t.employment_type] ??
                                t.employment_type)
                              : "Belirtilmedi"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={t.is_active ? "success" : "destructive"}
                        >
                          {t.is_active ? "Aktif" : "Pasif"}
                        </Badge>
                        <PermissionGate permission="teachers.edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(t);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate permission="teachers.delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(t.id);
                            }}
                          >
                            <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </div>
                    {t.subject_name && (
                      <div className="mt-3">
                        <Badge variant="secondary">{t.subject_name}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={!!previewTeacher}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTeacher(null);
            setShowTC(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {previewTeacher && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium">
                    {previewTeacher.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div>{previewTeacher.full_name}</div>
                    <div className="text-muted-foreground text-sm font-normal">
                      {previewTeacher.email}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Separator className="my-4" />

              <div className="space-y-4 text-sm">
                {/* Genel */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <PreviewField label="Telefon" value={previewTeacher.phone} />
                  <div>
                    <span className="text-muted-foreground">TC Kimlik No</span>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">
                        {showTC
                          ? previewTeacher.tc_no || "-"
                          : maskTC(previewTeacher.tc_no)}
                      </p>
                      {previewTeacher.tc_no && (
                        <button
                          onClick={() => setShowTC(!showTC)}
                          className="text-primary text-xs hover:underline"
                        >
                          {showTC ? "Gizle" : "Göster"}
                        </button>
                      )}
                    </div>
                  </div>
                  <PreviewField
                    label="Durum"
                    value={previewTeacher.is_active ? "Aktif" : "Pasif"}
                  />
                  <PreviewField
                    label="Çalışma Türü"
                    value={
                      previewTeacher.employment_type
                        ? EMPLOYMENT_LABELS[previewTeacher.employment_type]
                        : null
                    }
                  />
                  <PreviewField
                    label="İşe Başlama"
                    value={previewTeacher.start_date}
                  />
                  <PreviewField
                    label="Üniversite"
                    value={previewTeacher.university}
                  />
                  <PreviewField
                    label="Bölüm"
                    value={previewTeacher.department}
                  />
                  <PreviewField
                    label="Ücret"
                    value={
                      previewTeacher.salary_amount != null
                        ? `₺${previewTeacher.salary_amount} (${previewTeacher.salary_type ? (SALARY_LABELS[previewTeacher.salary_type] ?? previewTeacher.salary_type) : "-"})`
                        : null
                    }
                  />
                  <PreviewField label="IBAN" value={previewTeacher.iban} />
                  <PreviewField
                    label="Acil Durum"
                    value={
                      previewTeacher.emergency_contact
                        ? `${previewTeacher.emergency_contact} (${previewTeacher.emergency_phone ?? "-"})`
                        : null
                    }
                  />
                </div>

                {previewTeacher.address && (
                  <div>
                    <span className="text-muted-foreground">Adres</span>
                    <p className="text-foreground mt-0.5">
                      {previewTeacher.address}
                    </p>
                  </div>
                )}

                {previewTeacher.notes && (
                  <div>
                    <span className="text-muted-foreground">Notlar</span>
                    <p className="text-foreground mt-0.5">
                      {previewTeacher.notes}
                    </p>
                  </div>
                )}

                {/* Branş */}
                {previewTeacher.subject_name && (
                  <div>
                    <span className="text-muted-foreground">Branş</span>
                    <p className="text-foreground mt-0.5">
                      {previewTeacher.subject_name}
                    </p>
                  </div>
                )}

                {/* Uygunluk */}
                {(previewTeacher.availability ?? []).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">
                      Uygunluk Saatleri
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {(previewTeacher.availability ?? []).map((a) => (
                        <div
                          key={a.id}
                          className="text-foreground flex items-center gap-2"
                        >
                          <span className="w-24 font-medium">
                            {DAY_NAMES[a.day_of_week]}
                          </span>
                          <span>
                            {a.start_time.slice(0, 5)} –{" "}
                            {a.end_time.slice(0, 5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPreviewTeacher(null)}
                  className="w-full sm:w-auto"
                >
                  Kapat
                </Button>
                <PermissionGate permission="teachers.delete">
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const id = previewTeacher.id;
                      setPreviewTeacher(null);
                      setDeleteId(id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Sil
                  </Button>
                </PermissionGate>
                <PermissionGate permission="teachers.edit">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                      const t = previewTeacher;
                      setPreviewTeacher(null);
                      openEdit(t);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Düzenle
                  </Button>
                </PermissionGate>
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
            Bu öğretmen kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
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

      {/* ---- Bulk Import Dialog ---- */}
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportFile(null);
            setImportResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Toplu Öğretmen İçe Aktarma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">
              <p>CSV dosyası ile toplu öğretmen ekleyebilirsiniz.</p>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/import/template/teachers`}
                className="text-primary mt-1 inline-block hover:underline"
                download
              >
                Örnek şablonu indir
              </a>
            </div>
            <div className="space-y-2">
              <Label>CSV Dosyası</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>
            {importResult && (
              <div className="border-border rounded-lg border p-3 text-sm">
                <p className="text-foreground font-medium">
                  {importResult.created} kayıt oluşturuldu
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-destructive text-xs font-medium">
                      Hatalar:
                    </p>
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-muted-foreground text-xs">
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Kapat
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? "Yükleniyor..." : "İçe Aktar"}
              </Button>
            </div>
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
