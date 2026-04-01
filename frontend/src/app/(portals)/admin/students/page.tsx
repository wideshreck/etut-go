"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Pencil,
  GraduationCap,
  X,
  UserPlus,
  Trash2,
  Search,
  Upload,
} from "lucide-react";
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

type Guardian = {
  id: string;
  full_name: string;
  relation: string;
  phone: string;
  email: string | null;
  occupation: string | null;
};

type Student = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  institution_id: string | null;
  is_active: boolean;
  tc_no: string | null;
  address: string | null;
  birth_date: string | null;
  gender: string | null;
  enrollment_date: string | null;
  enrollment_period: string | null;
  school: string | null;
  grade_level: string | null;
  target_exam: string | null;
  enrollment_status: string | null;
  group_id: string | null;
  group_name: string | null;
  weekly_credits: number | null;
  credit_duration: number | null;
  notes: string | null;
  guardians: Guardian[];
  created_at: string;
  updated_at: string;
};

type GroupOption = { id: string; name: string; grade_level: string };

type GuardianRow = {
  key: string;
  full_name: string;
  relation: string;
  phone: string;
  email: string;
  occupation: string;
};

type PaymentInfo = {
  id: string;
  installment_no: number;
  amount: number;
  status: string;
  due_date: string;
  paid_date: string | null;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ENROLLMENT_LABELS: Record<string, string> = {
  active: "Aktif",
  frozen: "Donduruldu",
  withdrawn: "Kayıt Silindi",
  graduated: "Mezun",
};

const ENROLLMENT_VARIANTS: Record<
  string,
  "success" | "warning" | "destructive" | "secondary"
> = {
  active: "success",
  frozen: "warning",
  withdrawn: "destructive",
  graduated: "secondary",
};

const GRADE_LEVELS = [
  "8. Sınıf",
  "9. Sınıf",
  "10. Sınıf",
  "11. Sınıf",
  "12. Sınıf",
  "Mezun",
];

const TARGET_EXAMS = [
  "LGS",
  "YKS-Sayısal",
  "YKS-Eşit Ağırlık",
  "YKS-Sözel",
  "YKS-Dil",
];

const GENDERS = ["Erkek", "Kadın"];

const RELATIONS = ["Anne", "Baba", "Abi", "Abla", "Diğer"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/*  Helper: unique key generator                                       */
/* ------------------------------------------------------------------ */

let _keyCounter = 0;
function nextKey() {
  _keyCounter += 1;
  return `guardian-${_keyCounter}-${Date.now()}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [allGroups, setAllGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  /* dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");

  /* preview dialog */
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [showTC, setShowTC] = useState(false);

  /* payment preview */
  const [previewPayments, setPreviewPayments] = useState<PaymentInfo[]>([]);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* form — tab 1 (personal) */
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [tcNo, setTcNo] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  /* form — tab 2 (guardians) */
  const [guardianRows, setGuardianRows] = useState<GuardianRow[]>([]);

  /* search & filter */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  /* form — tab 3 (academic) */
  const [enrollmentDate, setEnrollmentDate] = useState("");
  const [enrollmentPeriod, setEnrollmentPeriod] = useState("");
  const [school, setSchool] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [groupId, setGroupId] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState("");
  const [weeklyCredits, setWeeklyCredits] = useState("");
  const [creditDuration, setCreditDuration] = useState("");

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
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/import/students`,
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
      toast.success(`${data.created} öğrenci başarıyla içe aktarıldı`);
      if (data.created > 0) fetchStudents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setImporting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchStudents = useCallback(
    (search?: string, groupId?: string, status?: string) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (groupId && groupId !== "all") params.set("group_id", groupId);
      if (status && status !== "all") params.set("enrollment_status", status);
      const query = params.toString();
      api
        .get<Student[]>(`/api/v1/admin/students${query ? `?${query}` : ""}`)
        .then((data) => setStudents(data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [],
  );

  const fetchGroups = useCallback(() => {
    api
      .get<GroupOption[]>("/api/v1/admin/groups")
      .then((data) => setAllGroups(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchGroups();
  }, [fetchStudents, fetchGroups]);

  /* debounced search & filters */
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStudents(searchQuery, filterGroup, filterStatus);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, filterGroup, filterStatus, fetchStudents]);

  useEffect(() => {
    if (previewStudent) {
      api
        .get<PaymentInfo[]>(
          `/api/v1/admin/students/${previewStudent.id}/payments`,
        )
        .then((data) => setPreviewPayments(data ?? []))
        .catch(() => setPreviewPayments([]));
    } else {
      setPreviewPayments([]);
    }
  }, [previewStudent]);

  /* ---------------------------------------------------------------- */
  /*  Dialog helpers                                                    */
  /* ---------------------------------------------------------------- */

  function resetForm() {
    setFullName("");
    setEmail("");
    setPassword("");
    setPhone("");
    setTcNo("");
    setBirthDate("");
    setGender("");
    setAddress("");
    setNotes("");
    setGuardianRows([]);
    setEnrollmentDate("");
    setEnrollmentPeriod("");
    setSchool("");
    setGradeLevel("");
    setTargetExam("");
    setGroupId("");
    setEnrollmentStatus("");
    setWeeklyCredits("");
    setCreditDuration("");
    setActiveTab("personal");
  }

  function openCreate() {
    setEditingStudent(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(student: Student) {
    setEditingStudent(student);
    setFullName(student.full_name);
    setEmail(student.email);
    setPassword("");
    setPhone(student.phone ?? "");
    setTcNo(student.tc_no ?? "");
    setBirthDate(student.birth_date ?? "");
    setGender(student.gender ?? "");
    setAddress(student.address ?? "");
    setNotes(student.notes ?? "");
    setGuardianRows(
      student.guardians.map((g) => ({
        key: nextKey(),
        full_name: g.full_name,
        relation: g.relation,
        phone: g.phone,
        email: g.email ?? "",
        occupation: g.occupation ?? "",
      })),
    );
    setEnrollmentDate(student.enrollment_date ?? "");
    setEnrollmentPeriod(student.enrollment_period ?? "");
    setSchool(student.school ?? "");
    setGradeLevel(student.grade_level ?? "");
    setTargetExam(student.target_exam ?? "");
    setGroupId(student.group_id ?? "");
    setEnrollmentStatus(student.enrollment_status ?? "");
    setWeeklyCredits(
      student.weekly_credits != null ? String(student.weekly_credits) : "",
    );
    setCreditDuration(
      student.credit_duration != null ? String(student.credit_duration) : "",
    );
    setActiveTab("personal");
    setDialogOpen(true);
  }

  /* ---------------------------------------------------------------- */
  /*  Guardian helpers                                                  */
  /* ---------------------------------------------------------------- */

  function addGuardianRow() {
    setGuardianRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        full_name: "",
        relation: "",
        phone: "",
        email: "",
        occupation: "",
      },
    ]);
  }

  function updateGuardianRow(
    key: string,
    field: keyof Omit<GuardianRow, "key">,
    value: string,
  ) {
    setGuardianRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function removeGuardianRow(key: string) {
    setGuardianRows((prev) => prev.filter((r) => r.key !== key));
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
      birth_date: birthDate || null,
      gender: gender || null,
      address: address || null,
      notes: notes || null,
      enrollment_date: enrollmentDate || null,
      enrollment_period: enrollmentPeriod || null,
      school: school || null,
      grade_level: gradeLevel || null,
      target_exam: targetExam || null,
      group_id: groupId || null,
      weekly_credits: weeklyCredits ? Number(weeklyCredits) : null,
      credit_duration: creditDuration ? Number(creditDuration) : null,
      guardians: guardianRows
        .filter((g) => g.full_name)
        .map((g) => ({
          full_name: g.full_name,
          relation: g.relation,
          phone: g.phone,
          email: g.email || null,
          occupation: g.occupation || null,
        })),
    };

    if (editingStudent) {
      payload.enrollment_status = enrollmentStatus || null;
    }

    try {
      if (editingStudent) {
        await api.put(`/api/v1/admin/students/${editingStudent.id}`, payload);
        toast.success("Öğrenci başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/students", {
          ...payload,
          email,
          password,
        });
        toast.success("Öğrenci başarıyla oluşturuldu");
      }
      setDialogOpen(false);
      resetForm();
      fetchStudents();
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
      await api.delete(`/api/v1/admin/students/${deleteId}`);
      toast.success("Öğrenci başarıyla silindi");
      setDeleteId(null);
      fetchStudents();
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
          Öğrenciler
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            İçe Aktar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Öğrenci Ekle
              </Button>
            </DialogTrigger>

            {/* ---- Create / Edit Dialog ---- */}
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingStudent ? "Öğrenci Düzenle" : "Yeni Öğrenci"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="personal" className="flex-1">
                      Kişisel
                    </TabsTrigger>
                    <TabsTrigger value="guardians" className="flex-1">
                      Veli Bilgileri
                    </TabsTrigger>
                    <TabsTrigger value="academic" className="flex-1">
                      Akademik
                    </TabsTrigger>
                  </TabsList>

                  {/* ======== Tab 1 — Kişisel ======== */}
                  <TabsContent value="personal">
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

                      {!editingStudent && (
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

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Doğum Tarihi</Label>
                          <Input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cinsiyet</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {GENDERS.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Adres</Label>
                        <Textarea
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          rows={2}
                        />
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

                  {/* ======== Tab 2 — Veli Bilgileri ======== */}
                  <TabsContent value="guardians">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <Label>Veliler</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addGuardianRow}
                        >
                          <UserPlus className="mr-1 h-3.5 w-3.5" />
                          Veli Ekle
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {guardianRows.map((row) => (
                            <motion.div
                              key={row.key}
                              layout
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 16 }}
                              transition={{ duration: 0.2 }}
                              className="border-border space-y-3 rounded-lg border p-4"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-foreground text-sm font-medium">
                                  Veli
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => removeGuardianRow(row.key)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Ad Soyad</Label>
                                  <Input
                                    value={row.full_name}
                                    onChange={(e) =>
                                      updateGuardianRow(
                                        row.key,
                                        "full_name",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Yakınlık</Label>
                                  <Select
                                    value={row.relation}
                                    onValueChange={(v) =>
                                      updateGuardianRow(row.key, "relation", v)
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {RELATIONS.map((r) => (
                                        <SelectItem key={r} value={r}>
                                          {r}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Telefon</Label>
                                  <Input
                                    value={row.phone}
                                    onChange={(e) =>
                                      updateGuardianRow(
                                        row.key,
                                        "phone",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">E-posta</Label>
                                  <Input
                                    type="email"
                                    value={row.email}
                                    onChange={(e) =>
                                      updateGuardianRow(
                                        row.key,
                                        "email",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-xs">Meslek</Label>
                                  <Input
                                    value={row.occupation}
                                    onChange={(e) =>
                                      updateGuardianRow(
                                        row.key,
                                        "occupation",
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {guardianRows.length === 0 && (
                          <p className="text-muted-foreground text-sm">
                            Henüz veli bilgisi eklenmedi
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </TabsContent>

                  {/* ======== Tab 3 — Akademik ======== */}
                  <TabsContent value="academic">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Kayıt Tarihi</Label>
                          <Input
                            type="date"
                            value={enrollmentDate}
                            onChange={(e) => setEnrollmentDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Kayıt Dönemi</Label>
                          <Input
                            value={enrollmentPeriod}
                            onChange={(e) =>
                              setEnrollmentPeriod(e.target.value)
                            }
                            placeholder="2025-2026"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Okuduğu Okul</Label>
                        <Input
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Sınıf Seviyesi</Label>
                          <Select
                            value={gradeLevel}
                            onValueChange={setGradeLevel}
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
                          <Label>Hedef Sınav</Label>
                          <Select
                            value={targetExam}
                            onValueChange={setTargetExam}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_EXAMS.map((te) => (
                                <SelectItem key={te} value={te}>
                                  {te}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Sınıf Atama</Label>
                        <Select value={groupId} onValueChange={setGroupId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {allGroups.map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Haftalık Özel Ders Kredisi</Label>
                          <Input
                            type="number"
                            min={0}
                            value={weeklyCredits}
                            onChange={(e) => setWeeklyCredits(e.target.value)}
                            placeholder="Örn: 2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Kredi Süresi (dk)</Label>
                          <Select
                            value={creditDuration}
                            onValueChange={setCreditDuration}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 dakika</SelectItem>
                              <SelectItem value="45">45 dakika</SelectItem>
                              <SelectItem value="60">60 dakika</SelectItem>
                              <SelectItem value="90">90 dakika</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {editingStudent && (
                        <div className="space-y-2">
                          <Label>Kayıt Durumu</Label>
                          <Select
                            value={enrollmentStatus}
                            onValueChange={setEnrollmentStatus}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seçin" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ENROLLMENT_LABELS).map(
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
                      : editingStudent
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
            placeholder="Ad, e-posta, telefon veya TC ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Sınıflar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Sınıflar</SelectItem>
            {allGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Durumlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="frozen">Donduruldu</SelectItem>
            <SelectItem value="withdrawn">Kayıt Silindi</SelectItem>
            <SelectItem value="graduated">Mezun</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {students.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <GraduationCap className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                Henüz öğrenci eklenmedi
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
                  <TableHead>Sınıf</TableHead>
                  <TableHead>Kademe</TableHead>
                  <TableHead>Hedef Sınav</TableHead>
                  <TableHead>Kayıt Durumu</TableHead>
                  <TableHead className="w-20">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                    onClick={() => setPreviewStudent(s)}
                  >
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.group_name ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.grade_level ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.target_exam ?? "-"}
                    </TableCell>
                    <TableCell>
                      {s.enrollment_status ? (
                        <Badge
                          variant={
                            ENROLLMENT_VARIANTS[s.enrollment_status] ??
                            "secondary"
                          }
                        >
                          {ENROLLMENT_LABELS[s.enrollment_status] ??
                            s.enrollment_status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(s);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(s.id);
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
            {students.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card
                  className="hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => setPreviewStudent(s)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                          {s.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {s.full_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {s.grade_level ?? "Belirtilmedi"}
                            {s.group_name ? ` · ${s.group_name}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.enrollment_status && (
                          <Badge
                            variant={
                              ENROLLMENT_VARIANTS[s.enrollment_status] ??
                              "secondary"
                            }
                          >
                            {ENROLLMENT_LABELS[s.enrollment_status] ??
                              s.enrollment_status}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(s);
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
                            setDeleteId(s.id);
                          }}
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
        </>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={!!previewStudent}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewStudent(null);
            setShowTC(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {previewStudent && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium">
                    {previewStudent.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div>{previewStudent.full_name}</div>
                    <div className="text-muted-foreground text-sm font-normal">
                      {previewStudent.email}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Separator className="my-4" />

              <div className="space-y-4 text-sm">
                {/* Kişisel & Akademik */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">TC Kimlik No</span>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground">
                        {showTC
                          ? previewStudent.tc_no || "-"
                          : maskTC(previewStudent.tc_no)}
                      </p>
                      {previewStudent.tc_no && (
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
                    label="Doğum Tarihi"
                    value={previewStudent.birth_date}
                  />
                  <PreviewField
                    label="Cinsiyet"
                    value={previewStudent.gender}
                  />
                  <PreviewField label="Telefon" value={previewStudent.phone} />
                  <PreviewField label="Okul" value={previewStudent.school} />
                  <PreviewField
                    label="Kademe"
                    value={previewStudent.grade_level}
                  />
                  <PreviewField
                    label="Hedef Sınav"
                    value={previewStudent.target_exam}
                  />
                  <PreviewField
                    label="Sınıf"
                    value={previewStudent.group_name}
                  />
                  <PreviewField
                    label="Dönem"
                    value={previewStudent.enrollment_period}
                  />
                  <PreviewField
                    label="Kayıt Tarihi"
                    value={previewStudent.enrollment_date}
                  />
                  <PreviewField
                    label="Durum"
                    value={
                      previewStudent.enrollment_status
                        ? (ENROLLMENT_LABELS[
                            previewStudent.enrollment_status
                          ] ?? previewStudent.enrollment_status)
                        : null
                    }
                  />
                  <PreviewField
                    label="Haftalık Kredi"
                    value={
                      previewStudent.weekly_credits
                        ? `${previewStudent.weekly_credits} ders (${previewStudent.credit_duration ?? 60} dk)`
                        : null
                    }
                  />
                </div>

                {/* Ödeme Durumu */}
                {previewPayments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-muted-foreground">
                        Ödeme Durumu
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {previewPayments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-foreground">
                              Taksit {p.installment_no}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {formatCurrency(p.amount)}
                              </span>
                              <Badge
                                variant={
                                  p.status === "paid"
                                    ? "success"
                                    : p.status === "overdue"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {p.status === "paid"
                                  ? "Ödendi"
                                  : p.status === "overdue"
                                    ? "Gecikmiş"
                                    : "Bekliyor"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Veliler */}
                {previewStudent.guardians.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <span className="text-muted-foreground">Veliler</span>
                      <div className="mt-1.5 space-y-2">
                        {previewStudent.guardians.map((g) => (
                          <div
                            key={g.id}
                            className="text-foreground flex items-center gap-2"
                          >
                            <span className="font-medium">{g.full_name}</span>
                            <span className="text-muted-foreground">
                              ({g.relation})
                            </span>
                            <span className="text-muted-foreground">
                              {g.phone}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={async () => {
                          try {
                            const result = await api.post<{
                              parent_id: string;
                              email: string;
                              temporary_password: string;
                              guardian_name: string;
                            }>(
                              `/api/v1/admin/students/${previewStudent.id}/parent-account`,
                            );
                            toast.success(
                              `Veli hesabı oluşturuldu. E-posta: ${result.email}, Geçici şifre: ${result.temporary_password}`,
                              { duration: 15000 },
                            );
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Bir hata oluştu",
                            );
                          }
                        }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Veli Hesabı Oluştur
                      </Button>
                    </div>
                  </>
                )}

                {/* Adres */}
                {previewStudent.address && (
                  <div>
                    <span className="text-muted-foreground">Adres</span>
                    <p className="text-foreground mt-0.5">
                      {previewStudent.address}
                    </p>
                  </div>
                )}

                {previewStudent.notes && (
                  <div>
                    <span className="text-muted-foreground">Notlar</span>
                    <p className="text-foreground mt-0.5">
                      {previewStudent.notes}
                    </p>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPreviewStudent(null)}
                  className="w-full sm:w-auto"
                >
                  Kapat
                </Button>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const id = previewStudent.id;
                    setPreviewStudent(null);
                    setDeleteId(id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sil
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const s = previewStudent;
                    setPreviewStudent(null);
                    openEdit(s);
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
            Bu öğrenci kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
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
            <DialogTitle>Toplu Öğrenci İçe Aktarma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">
              <p>CSV dosyası ile toplu öğrenci ekleyebilirsiniz.</p>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/admin/import/template/students`}
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
