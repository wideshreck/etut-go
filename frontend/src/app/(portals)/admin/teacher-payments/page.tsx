"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Banknote, Plus, Pencil, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TeacherPayment = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  period: string;
  base_salary: number;
  lesson_count: number;
  per_lesson_rate: number;
  lesson_total: number;
  bonus: number;
  deduction: number;
  total_amount: number;
  status: string;
  payment_method: string | null;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
};

type PayrollSummary = {
  total_teachers: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
};

type Teacher = {
  id: string;
  full_name: string;
  salary_type: string | null;
  salary_amount: number | null;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  paid: "\u00D6dendi",
  cancelled: "\u0130ptal",
};

const STATUS_VARIANTS: Record<string, "secondary" | "success" | "destructive"> =
  {
    pending: "secondary",
    paid: "success",
    cancelled: "destructive",
  };

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  bank_transfer: "Havale/EFT",
  credit_card: "Kredi Kartı",
  other: "Diğer",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeacherPaymentsPage() {
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  /* filters */
  const [period, setPeriod] = useState(currentPeriod());
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  /* create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [cTeacher, setCTeacher] = useState("");
  const [cPeriod, setCPeriod] = useState(currentPeriod());
  const [cBaseSalary, setCBaseSalary] = useState("");
  const [cLessonCount, setCLessonCount] = useState("");
  const [cPerLessonRate, setCPerLessonRate] = useState("");
  const [cBonus, setCBonus] = useState("0");
  const [cDeduction, setCDeduction] = useState("0");
  const [cNotes, setCNotes] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  /* pay dialog */
  const [payPayment, setPayPayment] = useState<TeacherPayment | null>(null);
  const [payMethod, setPayMethod] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [paySubmitting, setPaySubmitting] = useState(false);

  /* edit dialog */
  const [editPayment, setEditPayment] = useState<TeacherPayment | null>(null);
  const [eBaseSalary, setEBaseSalary] = useState("");
  const [eLessonCount, setELessonCount] = useState("");
  const [ePerLessonRate, setEPerLessonRate] = useState("");
  const [eBonus, setEBonus] = useState("");
  const [eDeduction, setEDeduction] = useState("");
  const [eNotes, setENotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchPayments = useCallback(() => {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    if (filterTeacher) params.set("teacher_id", filterTeacher);
    if (filterStatus) params.set("status", filterStatus);
    const qs = params.toString();
    api
      .get<TeacherPayment[]>(
        `/api/v1/admin/teacher-payments${qs ? `?${qs}` : ""}`,
      )
      .then((data) => setPayments(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, filterTeacher, filterStatus]);

  const fetchSummary = useCallback(() => {
    const params = new URLSearchParams();
    if (period) params.set("period", period);
    api
      .get<PayrollSummary>(
        `/api/v1/admin/teacher-payments/summary?${params.toString()}`,
      )
      .then(setSummary)
      .catch(() => {});
  }, [period]);

  const fetchTeachers = useCallback(() => {
    api
      .get<Teacher[]>("/api/v1/admin/teachers")
      .then((data) =>
        setTeachers(
          (data ?? []).map((t) => ({
            id: t.id,
            full_name: t.full_name,
            salary_type: t.salary_type,
            salary_amount: t.salary_amount,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchSummary();
    fetchTeachers();
  }, [fetchPayments, fetchSummary, fetchTeachers]);

  /* ---------------------------------------------------------------- */
  /*  Create                                                           */
  /* ---------------------------------------------------------------- */

  function openCreate() {
    setCTeacher("");
    setCPeriod(period || currentPeriod());
    setCBaseSalary("");
    setCLessonCount("");
    setCPerLessonRate("");
    setCBonus("0");
    setCDeduction("0");
    setCNotes("");
    setCreateOpen(true);
  }

  /* auto-fill per_lesson_rate when teacher changes */
  function handleTeacherChange(teacherId: string) {
    setCTeacher(teacherId);
    const t = teachers.find((x) => x.id === teacherId);
    if (t?.salary_type === "per_lesson" && t.salary_amount) {
      setCPerLessonRate(String(t.salary_amount));
    }
  }

  const calcPreview = useMemo(() => {
    const base = Number(cBaseSalary) || 0;
    const lessons = Number(cLessonCount) || 0;
    const rate = Number(cPerLessonRate) || 0;
    const bonus = Number(cBonus) || 0;
    const deduction = Number(cDeduction) || 0;
    const lessonTotal = lessons * rate;
    const total = base + lessonTotal + bonus - deduction;
    return { base, lessons, rate, lessonTotal, bonus, deduction, total };
  }, [cBaseSalary, cLessonCount, cPerLessonRate, cBonus, cDeduction]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      await api.post("/api/v1/admin/teacher-payments", {
        teacher_id: cTeacher,
        period: cPeriod,
        base_salary: Number(cBaseSalary) || 0,
        lesson_count: Number(cLessonCount) || 0,
        per_lesson_rate: Number(cPerLessonRate) || 0,
        bonus: Number(cBonus) || 0,
        deduction: Number(cDeduction) || 0,
        notes: cNotes || null,
      });
      toast.success("Maaş başarıyla hesaplandı");
      setCreateOpen(false);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setCreateSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Pay                                                              */
  /* ---------------------------------------------------------------- */

  function openPay(payment: TeacherPayment) {
    setPayPayment(payment);
    setPayMethod("");
    setPayDate(todayISO());
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payPayment) return;
    setPaySubmitting(true);
    try {
      await api.put(`/api/v1/admin/teacher-payments/${payPayment.id}`, {
        status: "paid",
        payment_method: payMethod,
        paid_date: payDate,
      });
      toast.success("Ödeme başarıyla kaydedildi");
      setPayPayment(null);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setPaySubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Edit                                                             */
  /* ---------------------------------------------------------------- */

  function openEdit(payment: TeacherPayment) {
    setEditPayment(payment);
    setEBaseSalary(String(payment.base_salary));
    setELessonCount(String(payment.lesson_count));
    setEPerLessonRate(String(payment.per_lesson_rate));
    setEBonus(String(payment.bonus));
    setEDeduction(String(payment.deduction));
    setENotes(payment.notes ?? "");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editPayment) return;
    setEditSubmitting(true);
    try {
      await api.put(`/api/v1/admin/teacher-payments/${editPayment.id}`, {
        base_salary: Number(eBaseSalary) || 0,
        lesson_count: Number(eLessonCount) || 0,
        per_lesson_rate: Number(ePerLessonRate) || 0,
        bonus: Number(eBonus) || 0,
        deduction: Number(eDeduction) || 0,
        notes: eNotes || null,
      });
      toast.success("Maaş bilgisi güncellendi");
      setEditPayment(null);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setEditSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <h1 className="text-foreground flex items-center gap-2 text-xl font-semibold sm:text-2xl">
        <Banknote className="h-6 w-6" />
        Öğretmen Maaşları
      </h1>

      {/* Period selector + Summary cards */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Dönem</Label>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "Toplam Maaş",
              value: formatCurrency(summary.total_amount),
              accent: "",
            },
            {
              label: "Ödenen",
              value: formatCurrency(summary.paid_amount),
              accent: "border-l-4 border-l-success",
            },
            {
              label: "Bekleyen",
              value: formatCurrency(summary.pending_amount),
              accent: "border-l-4 border-l-warning",
            },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              <Card className={card.accent}>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground text-sm">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{card.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filters + action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs">Öğretmen</Label>
          <Select value={filterTeacher} onValueChange={setFilterTeacher}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px] space-y-1">
          <Label className="text-xs">Durum</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreate} className="sm:ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          Maaş Hesapla
        </Button>
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Banknote className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Bu dönemde maaş kaydı yok
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
                  <TableHead>Öğretmen</TableHead>
                  <TableHead>Dönem</TableHead>
                  <TableHead className="text-right">Baz Maaş</TableHead>
                  <TableHead className="text-right">Ders Sayısı</TableHead>
                  <TableHead className="text-right">Ders Ücreti</TableHead>
                  <TableHead className="text-right">Prim</TableHead>
                  <TableHead className="text-right">Kesinti</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="w-28">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="border-b transition-colors"
                  >
                    <TableCell className="font-medium">
                      {p.teacher_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.period}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.base_salary)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.lesson_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(p.lesson_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.bonus > 0 ? formatCurrency(p.bonus) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.deduction > 0 ? formatCurrency(p.deduction) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(p.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {p.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success hover:text-success h-8 px-2"
                            onClick={() => openPay(p)}
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            Ode
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
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
            {payments.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {p.teacher_name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {p.period} &middot; {p.lesson_count} ders
                        </p>
                        <p className="text-foreground mt-1 text-sm font-semibold">
                          {formatCurrency(p.total_amount)}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {p.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-success hover:text-success h-7 px-2 text-xs"
                          onClick={() => openPay(p)}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Ode
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ---- Create Dialog ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Maaş Hesapla</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Öğretmen</Label>
              <Select value={cTeacher} onValueChange={handleTeacherChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Öğretmen seçin" />
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

            <div className="space-y-2">
              <Label>Dönem</Label>
              <Input
                type="month"
                value={cPeriod}
                onChange={(e) => setCPeriod(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Baz Maaş</Label>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    TL
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cBaseSalary}
                    onChange={(e) => setCBaseSalary(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ders Sayısı</Label>
                <Input
                  type="number"
                  min={0}
                  value={cLessonCount}
                  onChange={(e) => setCLessonCount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ders Başı Ücret</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  TL
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cPerLessonRate}
                  onChange={(e) => setCPerLessonRate(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prim</Label>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    TL
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cBonus}
                    onChange={(e) => setCBonus(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Kesinti</Label>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    TL
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cDeduction}
                    onChange={(e) => setCDeduction(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Not</Label>
              <Textarea
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                placeholder="Opsiyonel not..."
                rows={2}
              />
            </div>

            {/* Live calculation preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="bg-muted rounded-lg p-3 text-sm"
            >
              <div className="flex justify-between">
                <span className="text-muted-foreground">Baz Maaş:</span>
                <span>{formatCurrency(calcPreview.base)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ders Ücreti:</span>
                <span>
                  {formatCurrency(calcPreview.lessonTotal)}
                  {calcPreview.lessons > 0 && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({calcPreview.lessons} ders x{" "}
                      {formatCurrency(calcPreview.rate)})
                    </span>
                  )}
                </span>
              </div>
              {calcPreview.bonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prim:</span>
                  <span className="text-success">
                    +{formatCurrency(calcPreview.bonus)}
                  </span>
                </div>
              )}
              {calcPreview.deduction > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kesinti:</span>
                  <span className="text-destructive">
                    -{formatCurrency(calcPreview.deduction)}
                  </span>
                </div>
              )}
              <Separator className="my-1.5" />
              <motion.div
                key={calcPreview.total}
                initial={{ scale: 1.02 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                className="flex justify-between font-semibold"
              >
                <span>TOPLAM:</span>
                <span>{formatCurrency(calcPreview.total)}</span>
              </motion.div>
            </motion.div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={createSubmitting}>
                {createSubmitting ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Pay Dialog ---- */}
      <Dialog
        open={!!payPayment}
        onOpenChange={(open) => !open && setPayPayment(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {payPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Ödeme Yap</DialogTitle>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Öğretmen:</span>{" "}
                  {payPayment.teacher_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Dönem:</span>{" "}
                  {payPayment.period}
                </p>
                <p>
                  <span className="text-muted-foreground">Tutar:</span>{" "}
                  {formatCurrency(payPayment.total_amount)}
                </p>
              </div>
              <form onSubmit={handlePay} className="space-y-4">
                <div className="space-y-2">
                  <Label>Ödeme Yöntemi</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ödeme Tarihi</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPayPayment(null)}
                  >
                    İptal
                  </Button>
                  <Button type="submit" disabled={paySubmitting}>
                    {paySubmitting ? "Kaydediliyor..." : "Öde"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Edit Dialog ---- */}
      <Dialog
        open={!!editPayment}
        onOpenChange={(open) => !open && setEditPayment(null)}
      >
        <DialogContent className="sm:max-w-lg">
          {editPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Maaş Düzenle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Baz Maaş</Label>
                    <div className="relative">
                      <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                        TL
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={eBaseSalary}
                        onChange={(e) => setEBaseSalary(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ders Sayısı</Label>
                    <Input
                      type="number"
                      min={0}
                      value={eLessonCount}
                      onChange={(e) => setELessonCount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ders Başı Ücret</Label>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                      TL
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={ePerLessonRate}
                      onChange={(e) => setEPerLessonRate(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prim</Label>
                    <div className="relative">
                      <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                        TL
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={eBonus}
                        onChange={(e) => setEBonus(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Kesinti</Label>
                    <div className="relative">
                      <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                        TL
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={eDeduction}
                        onChange={(e) => setEDeduction(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Not</Label>
                  <Textarea
                    value={eNotes}
                    onChange={(e) => setENotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditPayment(null)}
                  >
                    İptal
                  </Button>
                  <Button type="submit" disabled={editSubmitting}>
                    {editSubmitting ? "Kaydediliyor..." : "Güncelle"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
