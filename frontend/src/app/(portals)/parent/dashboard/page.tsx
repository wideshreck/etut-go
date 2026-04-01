"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  Wallet,
  Clock,
  Check,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScheduleSlot } from "@/components/schedule/timetable";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ChildInfo = {
  id: string;
  full_name: string;
  grade_level: string | null;
  target_exam: string | null;
  school: string | null;
};

type Assignment = {
  id: string;
  title: string;
  assignment_type: string;
  subject_name: string;
  subject_color?: string | null;
  teacher_name: string;
  due_date: string;
  is_completed: boolean;
};

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type Payment = {
  id: string;
  installment_no: number;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAYS_TR = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const TYPE_LABELS: Record<string, string> = {
  homework: "Ev Ödevi",
  test: "Test",
  project: "Proje",
  reading: "Okuma",
  practice: "Alıştırma",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function todayDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ParentDashboardPage() {
  const [child, setChild] = useState<ChildInfo | null>(null);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<ChildInfo>("/api/v1/parent/child"),
      api.get<ScheduleSlot[]>("/api/v1/parent/schedule"),
      api.get<Assignment[]>("/api/v1/parent/assignments"),
      api.get<{ summary: AttendanceSummary }>("/api/v1/parent/attendance"),
      api.get<Payment[]>("/api/v1/parent/payments"),
    ]).then(([cRes, sRes, aRes, attRes, pRes]) => {
      if (cRes.status === "fulfilled") setChild(cRes.value);
      if (sRes.status === "fulfilled") setSchedule(sRes.value ?? []);
      if (aRes.status === "fulfilled") setAssignments(aRes.value ?? []);
      if (attRes.status === "fulfilled")
        setAttendance(attRes.value?.summary ?? null);
      if (pRes.status === "fulfilled") setPayments(pRes.value ?? []);
      setLoading(false);
    });
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  /* Derived data */
  const todaySlots = schedule
    .filter((s) => s.day_of_week === todayDayOfWeek())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const pendingAssignments = assignments
    .filter((a) => !a.is_completed)
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

  const upcomingAssignments = pendingAssignments.slice(0, 5);

  const attendanceRate =
    attendance && attendance.total > 0
      ? Math.round(
          ((attendance.present + attendance.late) / attendance.total) * 100,
        )
      : 0;

  const overduePayments = payments.filter((p) => p.status === "overdue").length;

  const initials = child ? getInitials(child.full_name) : "";

  /* ---------------------------------------------------------------- */
  /*  Stat cards                                                       */
  /* ---------------------------------------------------------------- */

  const stats = [
    {
      label: "Katılım Oranı",
      value: attendance ? `%${attendanceRate}` : "—",
      accent:
        attendanceRate >= 80
          ? "border-l-4 border-l-success"
          : attendanceRate >= 60
            ? "border-l-4 border-l-warning"
            : "border-l-4 border-l-destructive",
      icon: ClipboardCheck,
    },
    {
      label: "Bekleyen Ödev",
      value: pendingAssignments.length,
      accent: "",
      icon: ClipboardList,
    },
    {
      label: "Ödeme Durumu",
      value: overduePayments > 0 ? `${overduePayments} gecikmiş` : "Sorun yok",
      accent: overduePayments > 0 ? "border-l-4 border-l-destructive" : "",
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Child Info Card */}
      {child && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-l-primary border-l-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium">
                  {initials}
                </div>
                <div>
                  <p className="text-foreground text-lg font-semibold">
                    {child.full_name}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {child.grade_level}
                    {child.target_exam ? ` \u00b7 ${child.target_exam}` : ""}
                    {child.school ? ` \u00b7 ${child.school}` : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
          >
            <Card className={stat.accent}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                    <p className="text-foreground mt-1 text-2xl font-semibold">
                      {stat.value}
                    </p>
                  </div>
                  <stat.icon className="text-muted-foreground h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Two Column Bottom */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming Assignments */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Yaklaşan Ödevler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ClipboardList className="text-muted-foreground/50 mb-3 h-10 w-10" />
                  <p className="text-muted-foreground text-sm">
                    Bekleyen ödev bulunmuyor
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAssignments.map((a, i) => {
                    const isOverdue = new Date(a.due_date) < new Date();
                    const color = a.subject_color || "#5B5BD6";
                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.45 + i * 0.05,
                          duration: 0.2,
                        }}
                        className="border-border rounded-lg border p-3"
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="outline">
                                {TYPE_LABELS[a.assignment_type] ??
                                  a.assignment_type}
                              </Badge>
                              <Badge variant="secondary">
                                {a.subject_name}
                              </Badge>
                            </div>
                            <p className="text-foreground text-sm font-medium">
                              {a.title}
                            </p>
                          </div>
                          {a.is_completed ? (
                            <div className="bg-success/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                              <Check className="text-success h-3.5 w-3.5" />
                            </div>
                          ) : isOverdue ? (
                            <div className="bg-destructive/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                              <AlertCircle className="text-destructive h-3.5 w-3.5" />
                            </div>
                          ) : (
                            <div className="bg-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                              <Clock className="text-muted-foreground h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                        <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                          <span>{a.teacher_name}</span>
                          <span>
                            Teslim:{" "}
                            {new Date(a.due_date).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Schedule */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                {`Bugünün Programı — ${DAYS_TR[new Date().getDay()]}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaySlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarDays className="text-muted-foreground/50 mb-3 h-10 w-10" />
                  <p className="text-muted-foreground text-sm">
                    Bugün planlanmış ders bulunmuyor
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySlots.map((s, i) => {
                    const color = s.subject_color || "#5B5BD6";
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.5 + i * 0.05,
                          duration: 0.2,
                        }}
                        className="border-border flex items-center gap-3 rounded-lg border p-3"
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <div className="flex-1">
                          <p className="text-foreground text-sm font-medium">
                            {s.subject_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {s.teacher_name}
                            {s.classroom ? ` \u00b7 ${s.classroom}` : ""}
                          </p>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
