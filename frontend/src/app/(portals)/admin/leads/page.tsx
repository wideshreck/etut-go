"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  UserSearch,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Search,
  MessageSquare,
  UserPlus,
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

type LeadNote = {
  id: string;
  content: string;
  created_by: string;
  author_name: string;
  created_at: string;
};

type Lead = {
  id: string;
  student_name: string;
  parent_name: string | null;
  phone: string;
  email: string | null;
  grade_level: string | null;
  target_exam: string | null;
  current_school: string | null;
  status: string;
  source: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  consultation_date: string | null;
  consultation_score: number | null;
  lost_reason: string | null;
  notes: string | null;
  notes_list: LeadNote[];
  created_at: string;
  updated_at: string;
};

type LeadSummary = {
  total: number;
  new: number;
  contacted: number;
  consultation_scheduled: number;
  consultation_done: number;
  enrolled: number;
  lost: number;
  conversion_rate: number;
};

type AdminUser = { id: string; full_name: string };

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  consultation_scheduled: "Görüşme Planlandı",
  consultation_done: "Görüşme Yapıldı",
  enrolled: "Kayıt Oldu",
  lost: "Kayıp",
};

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "warning" | "success" | "destructive" | "default" | "outline"
> = {
  new: "secondary",
  contacted: "outline",
  consultation_scheduled: "warning",
  consultation_done: "warning",
  enrolled: "success",
  lost: "destructive",
};

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Yüz Yüze",
  phone: "Telefon",
  website: "Web Sitesi",
  referral: "Referans",
  social_media: "Sosyal Medya",
  campaign: "Kampanya",
  other: "Diğer",
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<LeadSummary | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  /* dialog state */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("contact");

  /* preview dialog */
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* convert state */
  const [convertId, setConvertId] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  /* notes */
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  /* search & filter */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  /* form — tab 1 (contact) */
  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [source, setSource] = useState("");

  /* form — tab 2 (follow-up) */
  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [consultationDate, setConsultationDate] = useState("");
  const [consultationScore, setConsultationScore] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [notes, setNotes] = useState("");

  /* ref for notes scroll */
  const notesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchLeads = useCallback(
    (search?: string, statusFilter?: string, sourceFilter?: string) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      if (sourceFilter && sourceFilter !== "all")
        params.set("source", sourceFilter);
      const query = params.toString();
      api
        .get<Lead[]>(`/api/v1/admin/leads${query ? `?${query}` : ""}`)
        .then((data) => setLeads(data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [],
  );

  const fetchSummary = useCallback(() => {
    api
      .get<LeadSummary>("/api/v1/admin/leads/summary")
      .then(setSummary)
      .catch(() => {});
  }, []);

  const fetchAdminUsers = useCallback(() => {
    api
      .get<AdminUser[]>("/api/v1/admin/teachers")
      .then((data) => setAdminUsers(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchSummary();
    fetchAdminUsers();
  }, [fetchLeads, fetchSummary, fetchAdminUsers]);

  /* debounced search & filters */
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchLeads(searchQuery, filterStatus, filterSource);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, filterStatus, filterSource, fetchLeads]);

  /* ---------------------------------------------------------------- */
  /*  Dialog helpers                                                    */
  /* ---------------------------------------------------------------- */

  function resetForm() {
    setStudentName("");
    setParentName("");
    setPhone("");
    setEmail("");
    setCurrentSchool("");
    setGradeLevel("");
    setTargetExam("");
    setSource("");
    setStatus("");
    setAssignedTo("");
    setConsultationDate("");
    setConsultationScore("");
    setLostReason("");
    setNotes("");
    setActiveTab("contact");
  }

  function openCreate() {
    setEditingLead(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead);
    setStudentName(lead.student_name);
    setParentName(lead.parent_name ?? "");
    setPhone(lead.phone);
    setEmail(lead.email ?? "");
    setCurrentSchool(lead.current_school ?? "");
    setGradeLevel(lead.grade_level ?? "");
    setTargetExam(lead.target_exam ?? "");
    setSource(lead.source);
    setStatus(lead.status);
    setAssignedTo(lead.assigned_to ?? "");
    setConsultationDate(lead.consultation_date ?? "");
    setConsultationScore(
      lead.consultation_score ? String(lead.consultation_score) : "",
    );
    setLostReason(lead.lost_reason ?? "");
    setNotes(lead.notes ?? "");
    setActiveTab("contact");
    setDialogOpen(true);
  }

  /* ---------------------------------------------------------------- */
  /*  Submit                                                            */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      student_name: studentName,
      parent_name: parentName || null,
      phone,
      email: email || null,
      current_school: currentSchool || null,
      grade_level: gradeLevel || null,
      target_exam: targetExam || null,
      source: source || "other",
      notes: notes || null,
    };

    if (editingLead) {
      payload.status = status || null;
      payload.assigned_to = assignedTo || null;
      payload.consultation_date = consultationDate || null;
      payload.consultation_score = consultationScore
        ? Number(consultationScore)
        : null;
      payload.lost_reason = status === "lost" ? lostReason || null : null;
    }

    try {
      if (editingLead) {
        await api.put(`/api/v1/admin/leads/${editingLead.id}`, payload);
        toast.success("Aday başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/leads", payload);
        toast.success("Aday başarıyla oluşturuldu");
      }
      setDialogOpen(false);
      resetForm();
      fetchLeads(searchQuery, filterStatus, filterSource);
      fetchSummary();
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
      await api.delete(`/api/v1/admin/leads/${deleteId}`);
      toast.success("Aday başarıyla silindi");
      setDeleteId(null);
      fetchLeads(searchQuery, filterStatus, filterSource);
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Convert                                                           */
  /* ---------------------------------------------------------------- */

  async function handleConvert() {
    if (!convertId) return;
    setConverting(true);
    try {
      const result = await api.post<{ password: string }>(
        `/api/v1/admin/leads/${convertId}/convert`,
      );
      toast.success(`Öğrenci kaydedildi. Geçici şifre: ${result.password}`, {
        duration: 10000,
      });
      setConvertId(null);
      setPreviewLead(null);
      fetchLeads(searchQuery, filterStatus, filterSource);
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setConverting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Add note                                                          */
  /* ---------------------------------------------------------------- */

  async function handleAddNote() {
    if (!previewLead || !newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/api/v1/admin/leads/${previewLead.id}/notes`, {
        content: newNote.trim(),
      });
      /* refetch single lead to update notes_list */
      const updated = await api.get<Lead>(
        `/api/v1/admin/leads/${previewLead.id}`,
      );
      setPreviewLead(updated);
      /* also refresh leads list so notes_list stays in sync */
      fetchLeads(searchQuery, filterStatus, filterSource);
      setNewNote("");
      setTimeout(() => {
        notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      toast.success("Not eklendi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setAddingNote(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  const funnelCards = [
    { label: "Yeni", value: summary?.new ?? 0, variant: "secondary" as const },
    {
      label: "İletişime Geçildi",
      value: summary?.contacted ?? 0,
      variant: "outline" as const,
    },
    {
      label: "Görüşme Planlandı",
      value: summary?.consultation_scheduled ?? 0,
      variant: "warning" as const,
    },
    {
      label: "Görüşme Yapıldı",
      value: summary?.consultation_done ?? 0,
      variant: "warning" as const,
    },
    {
      label: "Kayıt Oldu",
      value: summary?.enrolled ?? 0,
      variant: "success" as const,
    },
    {
      label: "Kayıp",
      value: summary?.lost ?? 0,
      variant: "destructive" as const,
    },
    {
      label: "Dönüşüm Oranı",
      value: summary?.conversion_rate ?? 0,
      variant: "default" as const,
      isPercentage: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-foreground text-xl font-semibold sm:text-2xl">
          Ön Kayıt
        </h1>
      </div>

      {/* Funnel Summary Cards */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-7">
        {funnelCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="min-w-[140px] flex-shrink-0 sm:min-w-0"
          >
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs font-medium">
                  {card.label}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-foreground text-2xl font-bold">
                    {card.isPercentage
                      ? `%${(card.value ?? 0).toFixed(1)}`
                      : card.value}
                  </span>
                  <Badge variant={card.variant} className="text-[10px]">
                    {card.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Ad veya telefon ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Durum Filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Kaynak Filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kaynaklar</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Aday Ekle
        </Button>
      </div>

      {/* Content */}
      {leads.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserSearch className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                Henüz aday eklenmedi
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
                  <TableHead>Öğrenci Adı</TableHead>
                  <TableHead>Veli</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Kademe</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Görüşme Puanı</TableHead>
                  <TableHead className="w-24">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                    onClick={() => setPreviewLead(lead)}
                  >
                    <TableCell className="font-medium">
                      {lead.student_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.parent_name ?? "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.phone}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.grade_level ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANTS[lead.status] ?? "secondary"}
                      >
                        {STATUS_LABELS[lead.status] ?? lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.consultation_score ?? "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewLead(lead);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(lead);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(lead.id);
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
            {leads.map((lead, i) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card
                  className="hover:border-primary/30 cursor-pointer transition-colors"
                  onClick={() => setPreviewLead(lead)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                          {lead.student_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {lead.student_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {lead.parent_name ?? ""}{" "}
                            {lead.parent_name ? "·" : ""} {lead.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant={STATUS_VARIANTS[lead.status] ?? "secondary"}
                        >
                          {STATUS_LABELS[lead.status] ?? lead.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {SOURCE_LABELS[lead.source] ?? lead.source}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLead ? "Aday Düzenle" : "Yeni Aday"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="contact" className="flex-1">
                  İletişim
                </TabsTrigger>
                <TabsTrigger value="followup" className="flex-1">
                  Takip
                </TabsTrigger>
              </TabsList>

              {/* ======== Tab 1 — İletişim ======== */}
              <TabsContent value="contact">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Öğrenci Adı</Label>
                    <Input
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Veli Adı</Label>
                    <Input
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Telefon</Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-posta</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Okuduğu Okul</Label>
                    <Input
                      value={currentSchool}
                      onChange={(e) => setCurrentSchool(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Kademe</Label>
                      <Select value={gradeLevel} onValueChange={setGradeLevel}>
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
                      <Select value={targetExam} onValueChange={setTargetExam}>
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
                    <Label>Kaynak</Label>
                    <Select value={source} onValueChange={setSource}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SOURCE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              </TabsContent>

              {/* ======== Tab 2 — Takip ======== */}
              <TabsContent value="followup">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {editingLead && (
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Sorumlu</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {adminUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Görüşme Tarihi</Label>
                      <Input
                        type="datetime-local"
                        value={consultationDate}
                        onChange={(e) => setConsultationDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Görüşme Puanı</Label>
                      <Select
                        value={consultationScore}
                        onValueChange={setConsultationScore}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(
                            (n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {status === "lost" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <Label>Kayıp Nedeni</Label>
                      <Input
                        value={lostReason}
                        onChange={(e) => setLostReason(e.target.value)}
                        placeholder="Neden kayıp olarak işaretlendi?"
                      />
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <Label>Genel Not</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Aday hakkında notlar..."
                      rows={3}
                    />
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Kaydediliyor..."
                  : editingLead
                    ? "Güncelle"
                    : "Oluştur"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewLead}
        onOpenChange={(open) => !open && setPreviewLead(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {previewLead && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium">
                    {previewLead.student_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div>{previewLead.student_name}</div>
                    <div className="mt-1">
                      <Badge
                        variant={
                          STATUS_VARIANTS[previewLead.status] ?? "secondary"
                        }
                      >
                        {STATUS_LABELS[previewLead.status] ??
                          previewLead.status}
                      </Badge>
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Separator className="my-4" />

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <PreviewField label="Veli" value={previewLead.parent_name} />
                  <PreviewField label="Telefon" value={previewLead.phone} />
                  <PreviewField label="E-posta" value={previewLead.email} />
                  <PreviewField
                    label="Okul"
                    value={previewLead.current_school}
                  />
                  <PreviewField
                    label="Kademe"
                    value={previewLead.grade_level}
                  />
                  <PreviewField
                    label="Hedef Sınav"
                    value={previewLead.target_exam}
                  />
                  <PreviewField
                    label="Kaynak"
                    value={
                      SOURCE_LABELS[previewLead.source] ?? previewLead.source
                    }
                  />
                  <PreviewField
                    label="Sorumlu"
                    value={previewLead.assigned_to_name}
                  />
                  <PreviewField
                    label="Görüşme Tarihi"
                    value={formatDateTime(previewLead.consultation_date)}
                  />
                  <PreviewField
                    label="Görüşme Puanı"
                    value={
                      previewLead.consultation_score
                        ? String(previewLead.consultation_score)
                        : null
                    }
                  />
                  {previewLead.status === "lost" && (
                    <PreviewField
                      label="Kayıp Nedeni"
                      value={previewLead.lost_reason}
                    />
                  )}
                </div>

                {previewLead.notes && (
                  <div>
                    <span className="text-muted-foreground">Genel Not</span>
                    <p className="text-foreground mt-0.5">
                      {previewLead.notes}
                    </p>
                  </div>
                )}

                {/* Notes section */}
                <Separator />
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="text-muted-foreground h-4 w-4" />
                    <span className="text-foreground text-sm font-medium">
                      Notlar
                    </span>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {previewLead.notes_list?.map((note) => (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 16 }}
                          transition={{ duration: 0.2 }}
                          className="border-border rounded-lg border p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-foreground text-xs font-medium">
                              {note.author_name}
                            </span>
                            <span className="text-muted-foreground text-[10px]">
                              {formatDate(note.created_at)}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            {note.content}
                          </p>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {(!previewLead.notes_list ||
                      previewLead.notes_list.length === 0) && (
                      <p className="text-muted-foreground text-xs">
                        Henüz not eklenmedi
                      </p>
                    )}
                    <div ref={notesEndRef} />
                  </div>

                  {/* Add note */}
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Not ekle..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={addingNote || !newNote.trim()}
                      onClick={handleAddNote}
                    >
                      {addingNote ? "..." : "Ekle"}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => setPreviewLead(null)}
                  className="w-full sm:w-auto"
                >
                  Kapat
                </Button>
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const id = previewLead.id;
                    setPreviewLead(null);
                    setDeleteId(id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sil
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const lead = previewLead;
                    setPreviewLead(null);
                    openEdit(lead);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Düzenle
                </Button>
                {previewLead.status !== "enrolled" && (
                  <Button
                    className="bg-success hover:bg-success/90 text-success-foreground w-full sm:w-auto"
                    onClick={() => setConvertId(previewLead.id)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Öğrenciye Dönüştür
                  </Button>
                )}
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
            Bu aday kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
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

      {/* Convert Confirmation Dialog */}
      <Dialog
        open={!!convertId}
        onOpenChange={(open) => !open && setConvertId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Öğrenciye Dönüştür</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Bu aday öğrenci olarak sisteme kaydedilecektir. Devam etmek istiyor
            musunuz?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConvertId(null)}>
              İptal
            </Button>
            <Button
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleConvert}
              disabled={converting}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {converting ? "Dönüştürülüyor..." : "Dönüştür"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PreviewField helper                                                */
/* ------------------------------------------------------------------ */

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
