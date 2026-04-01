"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

type Expense = {
  id: string;
  category: string;
  amount: number;
  description: string;
  vendor: string | null;
  expense_date: string;
  payment_method: string | null;
  receipt_no: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  rent: "Kira",
  utilities: "Faturalar",
  internet: "İnternet/Telefon",
  supplies: "Kırtasiye/Malzeme",
  maintenance: "Bakım/Onarım",
  cleaning: "Temizlik",
  salary: "Maaş",
  insurance: "Sigorta",
  tax: "Vergi",
  marketing: "Reklam/Pazarlama",
  food: "Yiyecek/İçecek",
  transport: "Ulaşım/Servis",
  books: "Kitap/Yayın",
  equipment: "Ekipman/Teknoloji",
  other: "Diğer",
};

const CATEGORY_COLORS: Record<string, string> = {
  rent: "#6366f1",
  utilities: "#f59e0b",
  internet: "#3b82f6",
  supplies: "#8b5cf6",
  maintenance: "#ef4444",
  cleaning: "#10b981",
  salary: "#f97316",
  insurance: "#06b6d4",
  tax: "#64748b",
  marketing: "#ec4899",
  food: "#84cc16",
  transport: "#14b8a6",
  books: "#a855f7",
  equipment: "#0ea5e9",
  other: "#94a3b8",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  bank_transfer: "Havale/EFT",
  credit_card: "Kredi Kartı",
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

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#94a3b8";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  /* filters */
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* create / edit dialog */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [fCategory, setFCategory] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fDate, setFDate] = useState(todayISO());
  const [fMethod, setFMethod] = useState("");
  const [fReceiptNo, setFReceiptNo] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchExpenses = useCallback(() => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    api
      .get<Expense[]>(`/api/v1/admin/expenses${qs ? `?${qs}` : ""}`)
      .then((data) => setExpenses(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterCategory, dateFrom, dateTo]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  /* Monthly total */
  const monthlyTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  /* ---------------------------------------------------------------- */
  /*  Create / Edit                                                    */
  /* ---------------------------------------------------------------- */

  function openCreate() {
    setEditingExpense(null);
    setFCategory("");
    setFAmount("");
    setFDescription("");
    setFVendor("");
    setFDate(todayISO());
    setFMethod("");
    setFReceiptNo("");
    setFNotes("");
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setFCategory(expense.category);
    setFAmount(String(expense.amount));
    setFDescription(expense.description);
    setFVendor(expense.vendor ?? "");
    setFDate(expense.expense_date);
    setFMethod(expense.payment_method ?? "");
    setFReceiptNo(expense.receipt_no ?? "");
    setFNotes(expense.notes ?? "");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      category: fCategory,
      amount: Number(fAmount),
      description: fDescription,
      vendor: fVendor || null,
      expense_date: fDate,
      payment_method: fMethod || null,
      receipt_no: fReceiptNo || null,
      notes: fNotes || null,
    };
    try {
      if (editingExpense) {
        await api.put(`/api/v1/admin/expenses/${editingExpense.id}`, payload);
        toast.success("Gider başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/expenses", payload);
        toast.success("Gider başarıyla eklendi");
      }
      setDialogOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Delete                                                           */
  /* ---------------------------------------------------------------- */

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/expenses/${deleteId}`);
      toast.success("Gider başarıyla silindi");
      setDeleteId(null);
      fetchExpenses();
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
      <h1 className="text-foreground flex items-center gap-2 text-xl font-semibold sm:text-2xl">
        <Receipt className="h-6 w-6" />
        Giderler
      </h1>

      {/* Filters + action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs">Kategori</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Başlangıç</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Bitiş</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>

        <Button onClick={openCreate} className="sm:ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          Gider Ekle
        </Button>
      </div>

      {/* Monthly total card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-l-destructive border-l-4">
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              Toplam Gider (görünen)
            </p>
            <p className="text-destructive mt-1 text-2xl font-semibold">
              -{formatCurrency(monthlyTotal)}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Expense cards */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Henüz gider kaydı yok
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense, i) => (
            <motion.div
              key={expense.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
            >
              <Card
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: getCategoryColor(expense.category),
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline">
                        {CATEGORY_LABELS[expense.category] ?? expense.category}
                      </Badge>
                      <h3 className="text-foreground mt-1 text-sm font-medium">
                        {expense.description}
                      </h3>
                      {expense.vendor && (
                        <p className="text-muted-foreground text-xs">
                          {expense.vendor}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {new Date(expense.expense_date).toLocaleDateString(
                          "tr-TR",
                        )}
                        {expense.receipt_no &&
                          ` \u00B7 Makbuz: ${expense.receipt_no}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-destructive text-sm font-semibold">
                        -{formatCurrency(expense.amount)}
                      </p>
                      <div className="mt-1 flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(expense)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteId(expense.id)}
                        >
                          <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ---- Create/Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? "Gider Düzenle" : "Gider Ekle"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={fCategory} onValueChange={setFCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tutar</Label>
              <div className="relative">
                <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  TL
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={fDescription}
                onChange={(e) => setFDescription(e.target.value)}
                placeholder="Gider açıklaması"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tedarikçi/Firma</Label>
              <Input
                value={fVendor}
                onChange={(e) => setFVendor(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tarih</Label>
                <Input
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ödeme Yöntemi</Label>
                <Select value={fMethod} onValueChange={setFMethod}>
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
            </div>

            <div className="space-y-2">
              <Label>Makbuz/Fatura No</Label>
              <Input
                value={fReceiptNo}
                onChange={(e) => setFReceiptNo(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>

            <div className="space-y-2">
              <Label>Not</Label>
              <Textarea
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                placeholder="Opsiyonel not..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Iptal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Kaydediliyor..."
                  : editingExpense
                    ? "Guncelle"
                    : "Ekle"}
              </Button>
            </div>
          </form>
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
            Bu gider kaydı kalıcı olarak silinecektir. Devam etmek istiyor
            musunuz?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Iptal
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
