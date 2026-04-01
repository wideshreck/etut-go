"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Wallet,
  Printer,
} from "lucide-react";
import { maskTC } from "@/lib/utils";
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

type Payment = {
  id: string;
  student_id: string;
  student_name: string;
  institution_id: string;
  installment_no: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

type PaymentSummary = {
  total_expected: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  student_count: number;
};

type Student = { id: string; full_name: string };

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  overdue: "Gecikmiş",
  cancelled: "İptal",
};

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "success" | "destructive" | "warning"
> = {
  pending: "secondary",
  paid: "success",
  overdue: "destructive",
  cancelled: "warning",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  bank_transfer: "Havale/EFT",
  credit_card: "Kredi Kartı",
  other: "Diğer",
};

const INSTALLMENT_OPTIONS = [
  { value: "1", label: "1 (Peşin)" },
  { value: "3", label: "3" },
  { value: "6", label: "6" },
  { value: "10", label: "10" },
  { value: "12", label: "12" },
];

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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  /* filters */
  const [filterStudent, setFilterStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  /* bulk create dialog */
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStudentId, setBulkStudentId] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkCount, setBulkCount] = useState("1");
  const [bulkStartDate, setBulkStartDate] = useState("");
  const [bulkNotes, setBulkNotes] = useState("");
  const [discountRate, setDiscountRate] = useState("0");
  const [discountDescription, setDiscountDescription] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  /* collect payment dialog */
  const [collectPayment, setCollectPayment] = useState<Payment | null>(null);
  const [collectMethod, setCollectMethod] = useState("");
  const [collectDate, setCollectDate] = useState(todayISO());
  const [collectSubmitting, setCollectSubmitting] = useState(false);

  /* edit dialog */
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editPaidDate, setEditPaidDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* receipt state */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [receiptData, setReceiptData] = useState<any>(null);

  /* ---------------------------------------------------------------- */
  /*  Receipt                                                          */
  /* ---------------------------------------------------------------- */

  async function openReceipt(paymentId: string) {
    try {
      const data = await api.get(`/api/v1/admin/payments/${paymentId}/receipt`);
      setReceiptData(data);
    } catch {
      toast.error("Makbuz yüklenemedi");
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchPayments = useCallback(() => {
    const params = new URLSearchParams();
    if (filterStudent) params.set("student_id", filterStudent);
    if (filterStatus) params.set("status", filterStatus);
    const qs = params.toString();
    api
      .get<Payment[]>(`/api/v1/admin/payments${qs ? `?${qs}` : ""}`)
      .then((data) => setPayments(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStudent, filterStatus]);

  const fetchSummary = useCallback(() => {
    api
      .get<PaymentSummary>("/api/v1/admin/payments/summary")
      .then(setSummary)
      .catch(() => {});
  }, []);

  const fetchStudents = useCallback(() => {
    api
      .get<Student[]>("/api/v1/admin/students")
      .then((data) =>
        setStudents(
          (data ?? []).map((s) => ({ id: s.id, full_name: s.full_name })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchSummary();
    fetchStudents();
  }, [fetchPayments, fetchSummary, fetchStudents]);

  /* ---------------------------------------------------------------- */
  /*  Bulk create                                                      */
  /* ---------------------------------------------------------------- */

  function openBulkCreate() {
    setBulkStudentId("");
    setBulkAmount("");
    setBulkCount("1");
    setBulkStartDate("");
    setBulkNotes("");
    setDiscountRate("0");
    setDiscountDescription("");
    setBulkOpen(true);
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    setBulkSubmitting(true);
    try {
      await api.post("/api/v1/admin/payments/bulk", {
        student_id: bulkStudentId,
        total_amount: Number(bulkAmount),
        discount_rate: Number(discountRate),
        discount_description: discountDescription || null,
        installment_count: Number(bulkCount),
        start_date: bulkStartDate,
        notes: bulkNotes || null,
      });
      toast.success("Taksit planı başarıyla oluşturuldu");
      setBulkOpen(false);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setBulkSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Collect payment                                                  */
  /* ---------------------------------------------------------------- */

  function openCollect(payment: Payment) {
    setCollectPayment(payment);
    setCollectMethod("");
    setCollectDate(todayISO());
  }

  async function handleCollect(e: React.FormEvent) {
    e.preventDefault();
    if (!collectPayment) return;
    setCollectSubmitting(true);
    try {
      await api.put(`/api/v1/admin/payments/${collectPayment.id}`, {
        status: "paid",
        paid_date: collectDate,
        payment_method: collectMethod,
      });
      toast.success("Ödeme başarıyla kaydedildi");
      setCollectPayment(null);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setCollectSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Edit payment                                                     */
  /* ---------------------------------------------------------------- */

  function openEdit(payment: Payment) {
    setEditPayment(payment);
    setEditAmount(String(payment.amount));
    setEditDueDate(payment.due_date);
    setEditStatus(payment.status);
    setEditMethod(payment.payment_method ?? "");
    setEditPaidDate(payment.paid_date ?? "");
    setEditNotes(payment.notes ?? "");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editPayment) return;
    setEditSubmitting(true);
    try {
      await api.put(`/api/v1/admin/payments/${editPayment.id}`, {
        amount: Number(editAmount),
        due_date: editDueDate,
        status: editStatus,
        payment_method: editMethod || null,
        paid_date: editPaidDate || null,
        notes: editNotes || null,
      });
      toast.success("Ödeme başarıyla güncellendi");
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
  /*  Delete                                                           */
  /* ---------------------------------------------------------------- */

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/payments/${deleteId}`);
      toast.success("Ödeme başarıyla silindi");
      setDeleteId(null);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
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
      <h1 className="text-foreground text-xl font-semibold sm:text-2xl">
        Ödemeler
      </h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Toplam Gelir",
              value: formatCurrency(summary.total_expected),
              accent: "",
            },
            {
              label: "Tahsil Edilen",
              value: formatCurrency(summary.total_paid),
              accent: "border-l-4 border-l-success",
            },
            {
              label: "Bekleyen",
              value: formatCurrency(summary.total_pending),
              accent: "",
            },
            {
              label: "Gecikmiş",
              value: formatCurrency(summary.total_overdue),
              accent: "border-l-4 border-l-destructive",
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

      {/* Filters bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs">Öğrenci</Label>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
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

        <Button onClick={openBulkCreate} className="sm:ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          Taksit Planı Oluştur
        </Button>
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Henüz ödeme kaydı yok
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
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Taksit No</TableHead>
                  <TableHead>Tutar</TableHead>
                  <TableHead>Vade Tarihi</TableHead>
                  <TableHead>Ödeme Tarihi</TableHead>
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
                      {p.student_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.installment_no}
                    </TableCell>
                    <TableCell>{formatCurrency(p.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.due_date}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.paid_date ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(p.status === "pending" || p.status === "overdue") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success hover:text-success h-8 px-2"
                            onClick={() => openCollect(p)}
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            Ödendi
                          </Button>
                        )}
                        {p.status === "paid" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReceipt(p.id);
                            }}
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(p.id)}
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
                          {p.student_name}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Taksit {p.installment_no} &middot;{" "}
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Vade: {p.due_date}
                          {p.paid_date ? ` | Ödeme: ${p.paid_date}` : ""}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {(p.status === "pending" || p.status === "overdue") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-success hover:text-success h-7 px-2 text-xs"
                          onClick={() => openCollect(p)}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Ödendi
                        </Button>
                      )}
                      {p.status === "paid" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReceipt(p.id);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ---- Bulk Create Dialog ---- */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Taksit Planı Oluştur</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Öğrenci</Label>
              <Select value={bulkStudentId} onValueChange={setBulkStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Öğrenci seçin" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Toplam Tutar</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  ₺
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>İndirim Oranı (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    value={discountRate}
                    onChange={(e) => setDiscountRate(e.target.value)}
                    className="pr-8"
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>İndirim Açıklaması</Label>
                <Input
                  value={discountDescription}
                  onChange={(e) => setDiscountDescription(e.target.value)}
                  placeholder="Başarı Bursu, Kardeş İndirimi..."
                />
              </div>
            </div>

            {Number(bulkAmount) > 0 && Number(discountRate) > 0 && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Toplam Tutar:</span>
                  <span>{formatCurrency(Number(bulkAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    İndirim ({discountRate}%):
                  </span>
                  <span className="text-destructive">
                    -
                    {formatCurrency(
                      (Number(bulkAmount) * Number(discountRate)) / 100,
                    )}
                  </span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-medium">
                  <span>İndirimli Tutar:</span>
                  <span>
                    {formatCurrency(
                      Number(bulkAmount) * (1 - Number(discountRate) / 100),
                    )}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Taksit Sayısı</Label>
              <Select value={bulkCount} onValueChange={setBulkCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>İlk Taksit Tarihi</Label>
              <Input
                type="date"
                value={bulkStartDate}
                onChange={(e) => setBulkStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Not</Label>
              <Textarea
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Opsiyonel not..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkOpen(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={bulkSubmitting}>
                {bulkSubmitting ? "Oluşturuluyor..." : "Oluştur"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Collect Payment Dialog ---- */}
      <Dialog
        open={!!collectPayment}
        onOpenChange={(open) => !open && setCollectPayment(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {collectPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Ödeme Al</DialogTitle>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Öğrenci:</span>{" "}
                  {collectPayment.student_name}
                </p>
                <p>
                  <span className="text-muted-foreground">Taksit No:</span>{" "}
                  {collectPayment.installment_no}
                </p>
                <p>
                  <span className="text-muted-foreground">Tutar:</span>{" "}
                  {formatCurrency(collectPayment.amount)}
                </p>
              </div>
              <form onSubmit={handleCollect} className="space-y-4">
                <div className="space-y-2">
                  <Label>Ödeme Yöntemi</Label>
                  <Select
                    value={collectMethod}
                    onValueChange={setCollectMethod}
                  >
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
                    value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCollectPayment(null)}
                  >
                    İptal
                  </Button>
                  <Button type="submit" disabled={collectSubmitting}>
                    {collectSubmitting ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Edit Payment Dialog ---- */}
      <Dialog
        open={!!editPayment}
        onOpenChange={(open) => !open && setEditPayment(null)}
      >
        <DialogContent className="sm:max-w-md">
          {editPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Ödeme Düzenle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tutar</Label>
                  <div className="relative">
                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                      ₺
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="pl-7"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Vade Tarihi</Label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
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

                <div className="space-y-2">
                  <Label>Ödeme Yöntemi</Label>
                  <Select value={editMethod} onValueChange={setEditMethod}>
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
                    value={editPaidDate}
                    onChange={(e) => setEditPaidDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Not</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
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

      {/* ---- Delete Confirmation Dialog ---- */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Silme Onayı</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Bu ödeme kaydı kalıcı olarak silinecektir. Devam etmek istiyor
            musunuz?
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

      {/* ---- Receipt Dialog ---- */}
      <Dialog
        open={!!receiptData}
        onOpenChange={(open) => !open && setReceiptData(null)}
      >
        <DialogContent className="sm:max-w-md print:border-0 print:shadow-none">
          {receiptData && (
            <div id="receipt-content">
              <div className="border-border border-b pb-4 text-center">
                <h2 className="text-foreground text-lg font-semibold">
                  {receiptData.institution.name}
                </h2>
                {receiptData.institution.address && (
                  <p className="text-muted-foreground text-xs">
                    {receiptData.institution.address}
                  </p>
                )}
                {receiptData.institution.phone && (
                  <p className="text-muted-foreground text-xs">
                    Tel: {receiptData.institution.phone}
                  </p>
                )}
              </div>
              <div className="space-y-3 py-4 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">
                    TAHSILAT MAKBUZU
                  </p>
                  <p className="text-muted-foreground text-xs">
                    No: {receiptData.receipt_no}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Tarih:{" "}
                    {new Date(receiptData.date).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">Öğrenci:</span>
                  <span className="font-medium">
                    {receiptData.student.name}
                  </span>
                  <span className="text-muted-foreground">Taksit No:</span>
                  <span className="font-medium">
                    {receiptData.payment.installment_no}
                  </span>
                  <span className="text-muted-foreground">Tutar:</span>
                  <span className="text-foreground font-semibold">
                    {formatCurrency(receiptData.payment.amount)}
                  </span>
                  <span className="text-muted-foreground">Ödeme Yöntemi:</span>
                  <span className="font-medium">
                    {METHOD_LABELS[
                      receiptData.payment.payment_method as string
                    ] ||
                      receiptData.payment.payment_method ||
                      "-"}
                  </span>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setReceiptData(null)}>
                  Kapat
                </Button>
                <Button
                  onClick={() => {
                    const printWindow = window.open(
                      "",
                      "_blank",
                      "width=400,height=600",
                    );
                    if (!printWindow) return;
                    const r = receiptData;
                    const fmt = (n: number) =>
                      new Intl.NumberFormat("tr-TR", {
                        style: "currency",
                        currency: "TRY",
                      }).format(n);
                    const method =
                      r.payment.payment_method === "cash"
                        ? "Nakit"
                        : r.payment.payment_method === "bank_transfer"
                          ? "Havale/EFT"
                          : r.payment.payment_method === "credit_card"
                            ? "Kredi Kartı"
                            : r.payment.payment_method || "-";
                    printWindow.document.write(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Tahsilat Makbuzu - ${r.receipt_no}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; padding: 2rem; color: #111827; max-width: 500px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 1rem; margin-bottom: 1rem; }
    .header h1 { font-size: 1.125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .header .sub { font-size: 0.7rem; color: #6b7280; margin-top: 0.25rem; }
    .header .tax { font-size: 0.7rem; color: #374151; margin-top: 0.25rem; font-weight: 500; }
    .title { text-align: center; margin: 1rem 0; }
    .title h2 { font-size: 0.875rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; border: 1px solid #111827; display: inline-block; padding: 0.25rem 1rem; }
    .meta { display: flex; justify-content: space-between; font-size: 0.75rem; color: #374151; margin-bottom: 1rem; }
    hr { border: none; border-top: 1px solid #d1d5db; margin: 0.75rem 0; }
    .section-title { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 0.5rem; }
    .row { display: flex; justify-content: space-between; padding: 0.25rem 0; font-size: 0.8125rem; }
    .row .label { color: #6b7280; }
    .row .value { font-weight: 500; text-align: right; }
    .total-row { display: flex; justify-content: space-between; padding: 0.5rem 0; font-size: 1rem; font-weight: 700; border-top: 2px solid #111827; margin-top: 0.5rem; }
    .signatures { display: flex; justify-content: space-between; margin-top: 3rem; font-size: 0.75rem; color: #6b7280; }
    .sig-box { text-align: center; width: 40%; }
    .sig-line { border-top: 1px solid #9ca3af; margin-top: 2.5rem; padding-top: 0.25rem; }
    .footer { margin-top: 1.5rem; text-align: center; font-size: 0.5625rem; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 0.5rem; }
    .footer p { margin-top: 0.125rem; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${r.institution.name}</h1>
    ${r.institution.address ? `<p class="sub">${r.institution.address}</p>` : ""}
    ${r.institution.phone ? `<p class="sub">Tel: ${r.institution.phone}</p>` : ""}
    ${r.institution.tax_office ? `<p class="tax">Vergi Dairesi: ${r.institution.tax_office} — VKN: ${r.institution.tax_number || "-"}</p>` : ""}
  </div>

  <div class="title"><h2>TAHSİLAT MAKBUZU</h2></div>

  <div class="meta">
    <span>Makbuz No: <strong>${r.receipt_no}</strong></span>
    <span>Tarih: <strong>${new Date(r.date).toLocaleDateString("tr-TR")}</strong></span>
  </div>

  <hr />
  <p class="section-title">Tahsil Eden Kurum</p>
  <div class="row"><span class="label">Unvan:</span><span class="value">${r.institution.name}</span></div>
  ${r.institution.tax_office ? `<div class="row"><span class="label">Vergi Dairesi / VKN:</span><span class="value">${r.institution.tax_office} / ${r.institution.tax_number || "-"}</span></div>` : ""}

  <hr />
  <p class="section-title">Ödeme Yapan</p>
  <div class="row"><span class="label">Ad Soyad:</span><span class="value">${r.student.name}</span></div>
  ${r.student.tc_no ? `<div class="row"><span class="label">T.C. Kimlik No:</span><span class="value">${maskTC(r.student.tc_no)}</span></div>` : ""}
  ${r.student.phone ? `<div class="row"><span class="label">Telefon:</span><span class="value">${r.student.phone}</span></div>` : ""}

  <hr />
  <p class="section-title">Ödeme Detayı</p>
  <div class="row"><span class="label">Hizmet Türü:</span><span class="value">Eğitim Hizmeti Bedeli</span></div>
  <div class="row"><span class="label">Taksit No:</span><span class="value">${r.payment.installment_no}</span></div>
  <div class="row"><span class="label">Ödeme Yöntemi:</span><span class="value">${method}</span></div>
  <div class="total-row"><span>TAHSİL EDİLEN TUTAR:</span><span>${fmt(r.payment.amount)}</span></div>

  <div class="signatures">
    <div class="sig-box"><div class="sig-line">Tahsil Eden</div></div>
    <div class="sig-box"><div class="sig-line">Ödeme Yapan</div></div>
  </div>

  <div class="footer">
    <p>Bu belge VUK Md. 236 kapsamında düzenlenmiştir.</p>
    <p>Etüt Pro Eğitim Yönetim Sistemi tarafından oluşturulmuştur.</p>
  </div>
</body>
</html>`);
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Yazdır
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
