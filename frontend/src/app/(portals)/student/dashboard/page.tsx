"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  UserCheck,
  Clock,
  Megaphone,
  Pin,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScheduleSlot } from "@/components/schedule/timetable";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Assignment = {
  id: string;
  title: string;
  description: string;
  assignment_type: string;
  subject_name: string;
  subject_color?: string | null;
  teacher_name: string;
  due_date: string;
  is_completed: boolean;
  completed_at: string | null;
  teacher_note: string | null;
};

type CreditInfo = {
  weekly_credits: number;
  remaining_this_week: number;
  credit_duration: number;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  target_role: string;
  priority: string;
  is_pinned: boolean;
  expires_at: string | null;
  created_by: string;
  author_name: string;
  created_at: string;
  updated_at: string;
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

const PRIORITY_LABELS: Record<string, string> = {
  normal: "Normal",
  important: "Önemli",
  urgent: "Acil",
};

const PRIORITY_VARIANTS: Record<
  string,
  "secondary" | "warning" | "destructive"
> = {
  normal: "secondary",
  important: "warning",
  urgent: "destructive",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function todayDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 7 : jsDay; // convert: 1=Mon..7=Sun
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StudentDashboardPage() {
  const { user } = useAuth();

  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [attendance, setAttendance] = useState<{
    summary: { attendance_rate: number; absent: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<ScheduleSlot[]>("/api/v1/student/schedule"),
      api.get<Assignment[]>("/api/v1/student/assignments"),
      api.get<CreditInfo>("/api/v1/student/credits"),
      api.get<Announcement[]>("/api/v1/student/announcements"),
      api.get<{ summary: { attendance_rate: number; absent: number } }>(
        "/api/v1/student/attendance",
      ),
    ]).then(([sRes, aRes, cRes, annRes, attRes]) => {
      if (sRes.status === "fulfilled") setSchedule(sRes.value ?? []);
      if (aRes.status === "fulfilled") setAssignments(aRes.value ?? []);
      if (cRes.status === "fulfilled") setCredits(cRes.value);
      if (annRes.status === "fulfilled" && (annRes.value ?? []).length > 0)
        setAnnouncement((annRes.value ?? [])[0] ?? null);
      if (attRes.status === "fulfilled") setAttendance(attRes.value);
      setLoading(false);
    });
  }, []);

  /* Derived data */
  const todaySlots = schedule
    .filter((s) => s.day_of_week === todayDayOfWeek())
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const pendingAssignments = assignments
    .filter((a) => !a.is_completed)
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

  const nearestDue = pendingAssignments[0];
  const upcomingAssignments = pendingAssignments.slice(0, 3);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  /* ---------------------------------------------------------------- */
  /*  Stat cards                                                       */
  /* ---------------------------------------------------------------- */

  const stats: Array<{
    label: string;
    value: string | number;
    sub: string;
    icon: typeof CalendarDays;
    valueClassName?: string;
  }> = [
    {
      label: "Bugünkü Ders",
      value: todaySlots.length,
      sub:
        todaySlots.length > 0 && todaySlots[0]
          ? `İlk ders ${formatTime(todaySlots[0].start_time)}`
          : "Bugün ders yok",
      icon: CalendarDays,
    },
    {
      label: "Yaklaşan Ödev",
      value: pendingAssignments.length,
      sub: nearestDue
        ? `Teslim: ${new Date(nearestDue.due_date).toLocaleDateString("tr-TR")}`
        : "Bekleyen ödev yok",
      icon: ClipboardList,
    },
    {
      label: "Kalan Kredi",
      value: credits
        ? `${credits.remaining_this_week}/${credits.weekly_credits}`
        : "—",
      sub: credits ? `${credits.credit_duration} dk / ders` : "Yüklenemedi",
      icon: UserCheck,
    },
    {
      label: "Katılım Oranı",
      value: attendance ? `%${attendance.summary.attendance_rate}` : "—",
      sub: attendance
        ? `${attendance.summary.absent} devamsızlık`
        : "Yüklenemedi",
      icon: ClipboardCheck,
      valueClassName:
        (attendance?.summary.attendance_rate ?? 100) >= 80
          ? "text-success"
          : (attendance?.summary.attendance_rate ?? 100) >= 60
            ? "text-warning"
            : "text-destructive",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-foreground text-2xl font-semibold">
          Merhaba, {user?.full_name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("tr-TR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-2xl font-semibold",
                        stat.valueClassName ?? "text-foreground",
                      )}
                    >
                      {stat.value}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {stat.sub}
                    </p>
                  </div>
                  <stat.icon className="text-muted-foreground h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Today's Schedule */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Bugünkü Program — {DAYS_TR[new Date().getDay()]}
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
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.2 }}
                      className="border-border flex items-center gap-3 rounded-lg border p-3"
                      style={{ borderLeftWidth: 3, borderLeftColor: color }}
                    >
                      <div className="flex-1">
                        <p className="text-foreground text-sm font-medium">
                          {s.subject_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {s.teacher_name}
                          {s.classroom ? ` · ${s.classroom}` : ""}
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
                          {isOverdue ? (
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

        {/* Latest Announcement */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4" />
                Son Duyuru
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!announcement ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Megaphone className="text-muted-foreground/50 mb-3 h-10 w-10" />
                  <p className="text-muted-foreground text-sm">
                    Henüz duyuru yayınlanmadı
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "border-border rounded-lg border p-4",
                    announcement.is_pinned && "border-l-primary border-l-4",
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {announcement.is_pinned && (
                      <Pin className="text-primary h-3.5 w-3.5 shrink-0" />
                    )}
                    <Badge variant={PRIORITY_VARIANTS[announcement.priority]}>
                      {PRIORITY_LABELS[announcement.priority]}
                    </Badge>
                  </div>
                  <h3 className="text-foreground text-sm font-semibold">
                    {announcement.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">
                    {announcement.content}
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {announcement.author_name} &middot;{" "}
                    {new Date(announcement.created_at).toLocaleDateString(
                      "tr-TR",
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
