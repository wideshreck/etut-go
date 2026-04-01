"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Wallet, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Payment = {
  id: string;
  installment_no: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
};

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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StudentPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Payment[]>("/api/v1/student/payments")
      .then((data) => setPayments(data ?? []))
      .catch(() => {
        setError("Ödeme bilgisi yüklenemedi");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-foreground text-2xl font-semibold">Ödemelerim</h1>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="text-muted-foreground/50 mb-3 h-12 w-12" />
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  /* Derived summary */
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidAmount = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = totalAmount - paidAmount;

  const summaryCards = [
    {
      label: "Toplam Tutar",
      value: formatCurrency(totalAmount),
      accent: "",
    },
    {
      label: "Ödenen",
      value: formatCurrency(paidAmount),
      accent: "border-l-4 border-l-success",
    },
    {
      label: "Kalan",
      value: formatCurrency(remainingAmount),
      accent: remainingAmount > 0 ? "border-l-4 border-l-warning" : "",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Ödemelerim</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <Card className={card.accent}>
              <CardContent className="p-5">
                <p className="text-muted-foreground text-sm">{card.label}</p>
                <p className="text-foreground mt-1 text-2xl font-semibold">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Payment List */}
      {payments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Wallet className="text-muted-foreground/50 mb-3 h-12 w-12" />
          <p className="text-muted-foreground text-sm">
            Henüz ödeme kaydı bulunmuyor
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {payments.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.24 + i * 0.04 }}
            >
              <div className="border-border flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium",
                      p.status === "paid"
                        ? "bg-success/10 text-success"
                        : p.status === "overdue"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.installment_no}
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {formatCurrency(p.amount)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Vade: {formatDate(p.due_date)}
                    </p>
                    {p.paid_date && (
                      <p className="text-muted-foreground text-xs">
                        Ödeme: {formatDate(p.paid_date)}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
