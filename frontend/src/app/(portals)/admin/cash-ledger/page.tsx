"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { BookOpenCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CashEntry = {
  id: string;
  entry_type: string;
  category: string;
  amount: number;
  description: string;
  entry_date: string;
  reference_id: string | null;
  created_by_name: string | null;
  created_at: string;
};

type CashSummary = {
  total_income: number;
  total_expense: number;
  balance: number;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CASH_CATEGORIES: Record<string, string> = {
  student_payment: "Öğrenci Ödemesi",
  teacher_salary: "Öğretmen Maaşı",
  expense: "Gider",
  other_income: "Diğer Gelir",
  other_expense: "Diğer Gider",
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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CashLedgerPage() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);

  /* filters */
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [cEntryType, setCEntryType] = useState("income");
  const [cCategory, setCCategory] = useState("");
  const [cAmount, setCAmount] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cDate, setCDate] = useState(todayISO());
  const [cNotes, setCNotes] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch data                                                       */
  /* ---------------------------------------------------------------- */

  const fetchEntries = useCallback(() => {
    const params = new URLSearchParams();
    if (filterType) params.set("entry_type", filterType);
    if (filterCategory) params.set("category", filterCategory);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    api
      .get<CashEntry[]>(`/api/v1/admin/cash-ledger${qs ? `?${qs}` : ""}`)
      .then((data) => setEntries(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterType, filterCategory, dateFrom, dateTo]);

  const fetchSummary = useCallback(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    api
      .get<CashSummary>(
        `/api/v1/admin/cash-ledger/summary${qs ? `?${qs}` : ""}`,
      )
      .then(setSummary)
      .catch(() => {});
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
    fetchSummary();
  }, [fetchEntries, fetchSummary]);

  /* ---------------------------------------------------------------- */
  /*  Create                                                           */
  /* ---------------------------------------------------------------- */

  function openCreate() {
    setCEntryType("income");
    setCCategory("");
    setCAmount("");
    setCDescription("");
    setCDate(todayISO());
    setCNotes("");
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      await api.post("/api/v1/admin/cash-ledger", {
        entry_type: cEntryType,
        category: cCategory,
        amount: Number(cAmount),
        description: cDescription,
        entry_date: cDate,
        notes: cNotes || null,
      });
      toast.success("Kayıt başarıyla eklendi");
      setCreateOpen(false);
      fetchEntries();
      fetchSummary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setCreateSubmitting(false);
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
        <BookOpenCheck className="h-6 w-6" />
        Kasa Defteri
      </h1>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "Toplam Gelir",
              value: formatCurrency(summary.total_income),
              accent: "border-l-4 border-l-success",
              color: "text-success",
            },
            {
              label: "Toplam Gider",
              value: formatCurrency(summary.total_expense),
              accent: "border-l-4 border-l-destructive",
              color: "text-destructive",
            },
            {
              label: "Bakiye",
              value: formatCurrency(summary.balance),
              accent:
                summary.balance >= 0
                  ? "border-l-4 border-l-success"
                  : "border-l-4 border-l-destructive",
              color: summary.balance >= 0 ? "text-success" : "text-destructive",
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
                  <p className={cn("mt-1 text-2xl font-semibold", card.color)}>
                    {card.value}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-[140px] space-y-1">
          <Label className="text-xs">Tür</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="income">Gelir</SelectItem>
              <SelectItem value="expense">Gider</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[180px] space-y-1">
          <Label className="text-xs">Kategori</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {Object.entries(CASH_CATEGORIES).map(([val, label]) => (
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
          Manuel Kayıt
        </Button>
      </div>

      {/* Transaction list — timeline style */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpenCheck className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Henüz kasa kaydı yok
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="border-border flex items-center gap-3 rounded-lg border p-3"
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                  entry.entry_type === "income"
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {entry.entry_type === "income" ? "+" : "-"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm">{entry.description}</p>
                <p className="text-muted-foreground text-xs">
                  {new Date(entry.entry_date).toLocaleDateString("tr-TR")}
                  {" \u00B7 "}
                  {CASH_CATEGORIES[entry.category] ?? entry.category}
                  {entry.created_by_name && ` \u00B7 ${entry.created_by_name}`}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold",
                  entry.entry_type === "income"
                    ? "text-success"
                    : "text-destructive",
                )}
              >
                {entry.entry_type === "income" ? "+" : "-"}
                {formatCurrency(entry.amount)}
              </span>
            </motion.div>
          ))}
        </div>
      )}

      {/* ---- Create Dialog ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manuel Kayıt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Tür</Label>
              <Select value={cEntryType} onValueChange={setCEntryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Gelir</SelectItem>
                  <SelectItem value="expense">Gider</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={cCategory} onValueChange={setCCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CASH_CATEGORIES).map(([val, label]) => (
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
                  value={cAmount}
                  onChange={(e) => setCAmount(e.target.value)}
                  className="pl-8"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Açıklama</Label>
              <Input
                value={cDescription}
                onChange={(e) => setCDescription(e.target.value)}
                placeholder="Kayıt açıklaması"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
                required
              />
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
    </div>
  );
}
