"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ClipboardCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
};

type AttendanceRecord = {
  id: string;
  date: string;
  subject_name: string;
  status: string;
  note: string | null;
};

type AttendanceResponse = {
  summary: AttendanceSummary;
  recent: AttendanceRecord[];
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  present: "Geldi",
  absent: "Gelmedi",
  late: "Geç Kaldı",
  excused: "İzinli",
};

const STATUS_VARIANTS: Record<
  string,
  "success" | "destructive" | "warning" | "secondary"
> = {
  present: "success",
  absent: "destructive",
  late: "warning",
  excused: "secondary",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ParentAttendancePage() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AttendanceResponse>("/api/v1/parent/attendance")
      .then((data) => {
        setSummary(data.summary);
        setRecords(data.recent ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  const attendanceRate =
    summary && summary.total > 0
      ? Math.round(((summary.present + summary.late) / summary.total) * 100)
      : 0;

  const summaryCards = [
    {
      label: "Toplam Ders",
      value: summary?.total ?? 0,
      accent: "",
    },
    {
      label: "Katılım",
      value: (summary?.present ?? 0) + (summary?.late ?? 0),
      accent: "border-l-4 border-l-success",
    },
    {
      label: "Devamsızlık",
      value: summary?.absent ?? 0,
      accent:
        (summary?.absent ?? 0) > 0 ? "border-l-4 border-l-destructive" : "",
    },
    {
      label: "Katılım Oranı",
      value: `%${attendanceRate}`,
      accent:
        attendanceRate >= 80
          ? "border-l-4 border-l-success"
          : attendanceRate >= 60
            ? "border-l-4 border-l-warning"
            : "border-l-4 border-l-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Devamsızlık</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      {/* Recent Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Son Yoklama Kayıtları
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardCheck className="text-muted-foreground/50 mb-3 h-12 w-12" />
              <p className="text-muted-foreground text-sm">
                Henüz yoklama kaydı bulunmuyor
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.32 + i * 0.04 }}
                >
                  <div className="border-border flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {r.subject_name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(r.date).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANTS[r.status] ?? "secondary"}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
