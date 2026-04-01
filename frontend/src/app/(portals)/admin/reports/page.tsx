"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import {
  BarChart3,
  GraduationCap,
  Users,
  Layers,
  Wallet,
  ClipboardCheck,
  UserSearch,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OverviewData = {
  students: { total: number; active: number; frozen: number };
  teachers: { total: number };
  groups: { total: number; active: number };
  financial: {
    total_expected: number;
    total_paid: number;
    total_pending: number;
    total_overdue: number;
    collection_rate: number;
  };
  leads: { total: number; enrolled: number };
  attendance_rate_30d: number;
};

type FinancialMonthly = {
  year: number;
  month: number;
  month_name: string;
  expected: number;
  collected: number;
};

type AttendanceByGroup = {
  group_id: string;
  group_name: string;
  total_records: number;
  present_count: number;
  attendance_rate: number;
};

type StudentEnrollment = {
  by_grade: { label: string; count: number }[];
  by_exam: { label: string; count: number }[];
  by_status: { label: string; count: number }[];
};

type FinancialDetailed = {
  student_income: number;
  total_expenses: number;
  teacher_salaries: number;
  net_profit: number;
  expense_by_category: { category: string; amount: number }[];
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

function rateColor(rate: number): string {
  if (rate >= 80) return "text-success";
  if (rate >= 60) return "text-warning";
  return "text-destructive";
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  frozen: "Dondurulmuş",
  graduated: "Mezun",
  withdrawn: "Ayrılmış",
};

const STATUS_VARIANTS: Record<
  string,
  "success" | "warning" | "secondary" | "destructive"
> = {
  active: "success",
  frozen: "warning",
  graduated: "secondary",
  withdrawn: "destructive",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [financial, setFinancial] = useState<FinancialMonthly[]>([]);
  const [attendance, setAttendance] = useState<AttendanceByGroup[]>([]);
  const [enrollment, setEnrollment] = useState<StudentEnrollment | null>(null);
  const [financialDetailed, setFinancialDetailed] =
    useState<FinancialDetailed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<OverviewData>("/api/v1/admin/reports/overview"),
      api.get<FinancialMonthly[]>("/api/v1/admin/reports/financial-monthly"),
      api.get<AttendanceByGroup[]>("/api/v1/admin/reports/attendance-by-group"),
      api.get<StudentEnrollment>("/api/v1/admin/reports/student-enrollment"),
      api
        .get<FinancialDetailed>("/api/v1/admin/reports/financial-detailed")
        .catch(() => null),
    ])
      .then(([ov, fin, att, enr, finDet]) => {
        setOverview(ov);
        setFinancial(fin ?? []);
        setAttendance(att ?? []);
        setEnrollment(enr);
        if (finDet) setFinancialDetailed(finDet);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  const maxGrade = Math.max(
    ...(enrollment?.by_grade?.map((g) => g.count) ?? [1]),
  );
  const maxExam = Math.max(
    ...(enrollment?.by_exam?.map((e) => e.count) ?? [1]),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-foreground flex items-center gap-2 text-2xl font-semibold">
        <BarChart3 className="h-6 w-6" />
        Raporlar
      </h1>

      {/* Section 1: Kurum Ozeti */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kurum Özeti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {[
                {
                  label: "Öğrenci",
                  value: `${overview?.students?.active ?? 0} / ${overview?.students?.total ?? 0}`,
                  sub: `${overview?.students?.frozen ?? 0} dondurulmuş`,
                  icon: GraduationCap,
                },
                {
                  label: "Öğretmen",
                  value: overview?.teachers?.total ?? 0,
                  sub: "toplam",
                  icon: Users,
                },
                {
                  label: "Sınıf",
                  value: `${overview?.groups?.active ?? 0} / ${overview?.groups?.total ?? 0}`,
                  sub: "aktif / toplam",
                  icon: Layers,
                },
                {
                  label: "Tahsilat Oranı",
                  value: `%${(overview?.financial?.collection_rate ?? 0).toFixed(1)}`,
                  sub: "",
                  icon: Wallet,
                },
                {
                  label: "30 Günlük Katılım",
                  value: `%${(overview?.attendance_rate_30d ?? 0).toFixed(1)}`,
                  sub: "",
                  icon: ClipboardCheck,
                },
                {
                  label: "Ön Kayıt Dönüşüm",
                  value: `${overview?.leads?.enrolled ?? 0} / ${overview?.leads?.total ?? 0}`,
                  sub: "kayıt olan / toplam",
                  icon: UserSearch,
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  className="bg-muted/30 flex items-center gap-3 rounded-lg p-4"
                >
                  <stat.icon className="text-muted-foreground h-8 w-8 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {stat.label}
                    </p>
                    <p className="text-foreground text-lg font-semibold">
                      {stat.value}
                    </p>
                    {stat.sub && (
                      <p className="text-muted-foreground text-xs">
                        {stat.sub}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 2: Aylik Gelir Tablosu */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aylık Gelir Tablosu</CardTitle>
          </CardHeader>
          <CardContent>
            {financial.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ay</TableHead>
                        <TableHead className="text-right">Beklenen</TableHead>
                        <TableHead className="text-right">
                          Tahsil Edilen
                        </TableHead>
                        <TableHead className="text-right">Oran</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financial.map((row) => {
                        const rate =
                          row.expected > 0
                            ? (row.collected / row.expected) * 100
                            : 0;
                        return (
                          <TableRow key={row.month_name}>
                            <TableCell className="font-medium">
                              {row.month_name}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.expected)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(row.collected)}
                            </TableCell>
                            <TableCell className="text-right">
                              %{rate.toFixed(1)}
                            </TableCell>
                            <TableCell>
                              <div className="bg-muted h-2 w-full rounded-full">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{
                                    width: `${Math.min((row.collected / (row.expected || 1)) * 100, 100)}%`,
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-2 md:hidden">
                  {financial.map((row) => {
                    const rate =
                      row.expected > 0
                        ? (row.collected / row.expected) * 100
                        : 0;
                    return (
                      <div
                        key={row.month_name}
                        className="border-border flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {row.month_name}
                          </p>
                          <div className="bg-muted mt-1 h-1.5 w-24 rounded-full">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{
                                width: `${Math.min((row.collected / (row.expected || 1)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground text-sm font-medium">
                            {formatCurrency(row.collected)}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            / {formatCurrency(row.expected)} (%{rate.toFixed(1)}
                            )
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Henüz finansal veri bulunmuyor
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 3: Sinif Bazli Katilim */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sınıf Bazlı Katılım</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sınıf</TableHead>
                        <TableHead className="text-right">
                          Toplam Yoklama
                        </TableHead>
                        <TableHead className="text-right">Katılım</TableHead>
                        <TableHead className="text-right">Oran</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((row) => (
                        <TableRow key={row.group_name}>
                          <TableCell className="font-medium">
                            {row.group_name}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.total_records}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.present_count}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              rateColor(row.attendance_rate),
                            )}
                          >
                            %{(row.attendance_rate ?? 0).toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-2 md:hidden">
                  {attendance.map((row) => {
                    const rc = rateColor(row.attendance_rate);
                    return (
                      <div
                        key={row.group_name}
                        className="border-border flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {row.group_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {row.total_records} yoklama
                          </p>
                        </div>
                        <span className={cn("text-sm font-semibold", rc)}>
                          %{(row.attendance_rate ?? 0).toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Henüz yoklama verisi bulunmuyor
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 4: Ogrenci Dagilimi */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Öğrenci Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* By grade level */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-medium">
                  Kademeye Göre
                </p>
                {enrollment?.by_grade.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.count}
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(item.count / maxGrade) * 100}%`,
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
                {(!enrollment?.by_grade ||
                  enrollment.by_grade.length === 0) && (
                  <p className="text-muted-foreground text-xs">Veri yok</p>
                )}
              </div>

              {/* By target exam */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-medium">
                  Hedef Sınava Göre
                </p>
                {enrollment?.by_exam.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.count}
                      </span>
                    </div>
                    <div className="bg-muted h-2 w-full rounded-full">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(item.count / maxExam) * 100}%`,
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
                {(!enrollment?.by_exam || enrollment.by_exam.length === 0) && (
                  <p className="text-muted-foreground text-xs">Veri yok</p>
                )}
              </div>

              {/* By status */}
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm font-medium">
                  Duruma Göre
                </p>
                {enrollment?.by_status.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                    className="flex items-center justify-between"
                  >
                    <Badge variant={STATUS_VARIANTS[item.label] ?? "secondary"}>
                      {STATUS_LABELS[item.label] ?? item.label}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      {item.count}
                    </span>
                  </motion.div>
                ))}
                {(!enrollment?.by_status ||
                  enrollment.by_status.length === 0) && (
                  <p className="text-muted-foreground text-xs">Veri yok</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section 5: Gelir-Gider Özeti */}
      {financialDetailed && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gelir-Gider Özeti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                  {
                    label: "Öğrenci Geliri",
                    value: formatCurrency(financialDetailed.student_income),
                    color: "text-success",
                  },
                  {
                    label: "Toplam Gider",
                    value: formatCurrency(financialDetailed.total_expenses),
                    color: "text-destructive",
                  },
                  {
                    label: "Öğretmen Maaşları",
                    value: formatCurrency(financialDetailed.teacher_salaries),
                    color: "text-warning",
                  },
                  {
                    label: "Net Kâr/Zarar",
                    value: formatCurrency(financialDetailed.net_profit),
                    color:
                      financialDetailed.net_profit >= 0
                        ? "text-success"
                        : "text-destructive",
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.25 }}
                    className="bg-muted/30 rounded-lg p-4"
                  >
                    <p className="text-muted-foreground text-xs">
                      {stat.label}
                    </p>
                    <p className={cn("mt-1 text-lg font-semibold", stat.color)}>
                      {stat.value}
                    </p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Section 6: Gider Dağılımı */}
      {financialDetailed &&
        financialDetailed.expense_by_category &&
        financialDetailed.expense_by_category.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gider Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {financialDetailed.expense_by_category.map((item, i) => {
                    const maxAmount = Math.max(
                      ...financialDetailed.expense_by_category.map(
                        (c) => c.amount,
                      ),
                    );
                    return (
                      <motion.div
                        key={item.category}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">
                            {EXPENSE_CATEGORY_LABELS[item.category] ??
                              item.category}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                        <div className="bg-muted h-2 w-full rounded-full">
                          <div
                            className="bg-destructive/70 h-2 rounded-full"
                            style={{
                              width: `${(item.amount / (maxAmount || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
    </div>
  );
}
