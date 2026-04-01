"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import {
  GraduationCap,
  Users,
  Layers,
  BookOpen,
  TrendingUp,
  Wallet,
  CalendarClock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DashboardData = {
  student_count: number;
  teacher_count: number;
  group_count: number;
  subject_count: number;
  total_revenue: number;
  total_collected: number;
  total_overdue: number;
  recent_payments: {
    id: string;
    student_name: string;
    amount: number;
    paid_date: string | null;
  }[];
  upcoming_payments: {
    id: string;
    student_name: string;
    amount: number;
    due_date: string;
  }[];
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

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardData>("/api/v1/admin/dashboard")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Dashboard</h1>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Öğrenci Sayısı",
            value: data?.student_count ?? 0,
            icon: GraduationCap,
          },
          {
            label: "Öğretmen Sayısı",
            value: data?.teacher_count ?? 0,
            icon: Users,
          },
          {
            label: "Sınıf Sayısı",
            value: data?.group_count ?? 0,
            icon: Layers,
          },
          {
            label: "Branş Sayısı",
            value: data?.subject_count ?? 0,
            icon: BookOpen,
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-3xl font-semibold">{stat.value}</p>
                  </div>
                  <stat.icon className="text-muted-foreground h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Financial Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Toplam Gelir",
            value: formatCurrency(data?.total_revenue ?? 0),
            icon: TrendingUp,
            accent: "",
          },
          {
            label: "Tahsil Edilen",
            value: formatCurrency(data?.total_collected ?? 0),
            icon: Wallet,
            accent: "border-l-4 border-l-success",
          },
          {
            label: "Gecikmiş Ödemeler",
            value: formatCurrency(data?.total_overdue ?? 0),
            icon: CalendarClock,
            accent:
              (data?.total_overdue ?? 0) > 0
                ? "border-l-4 border-l-destructive"
                : "",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 + i * 0.08, duration: 0.3 }}
          >
            <Card className={card.accent}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {card.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">{card.value}</p>
                  </div>
                  <card.icon className="text-muted-foreground h-7 w-7" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Row 3: Recent & Upcoming Payments */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Payments */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                Son Ödemeler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recent_payments && data.recent_payments.length > 0 ? (
                <div className="space-y-3">
                  {data.recent_payments.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="text-foreground font-medium">
                          {p.student_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {p.paid_date ?? "-"}
                        </p>
                      </div>
                      <span className="text-foreground font-medium">
                        {formatCurrency(p.amount)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Henüz ödeme kaydı yok
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Payments */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.64, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" />
                Yaklaşan Vadeler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.upcoming_payments && data.upcoming_payments.length > 0 ? (
                <div className="space-y-3">
                  {data.upcoming_payments.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      whileHover={{ x: 4 }}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <p className="text-foreground font-medium">
                          {p.student_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {p.due_date}
                        </p>
                      </div>
                      <span className="text-foreground font-medium">
                        {formatCurrency(p.amount)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Henüz ödeme kaydı yok
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
