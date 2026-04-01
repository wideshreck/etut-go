"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  UserCheck,
  BookOpen,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ScheduleSlot = {
  id: string;
  group_id: string;
  group_name: string;
  subject_name: string;
  subject_color: string | null;
  classroom: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Assignment = {
  id: string;
  title: string;
  assignment_type: string;
  group_name: string | null;
  due_date: string;
  total_students: number;
  completed_count: number;
};

type PrivateLesson = {
  id: string;
  student_name: string;
  subject_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** JS getDay() returns 0=Sun..6=Sat; backend uses 1=Mon..6=Sat */
function todayDayOfWeek(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const d = new Date(dateStr);
  return d >= start && d < end;
}

function isActiveAssignment(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) >= today;
}

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "success"
      | "warning"
      | "destructive"
      | "outline";
  }
> = {
  scheduled: { label: "Planlandı", variant: "outline" },
  completed: { label: "Tamamlandı", variant: "success" },
  cancelled_by_teacher: { label: "İptal", variant: "destructive" },
  cancelled_by_student: { label: "İptal", variant: "destructive" },
  no_show: { label: "Gelmedi", variant: "warning" },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [privateLessons, setPrivateLessons] = useState<PrivateLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ScheduleSlot[]>("/api/v1/teacher/schedule").catch(() => []),
      api.get<Assignment[]>("/api/v1/teacher/assignments").catch(() => []),
      api
        .get<PrivateLesson[]>("/api/v1/teacher/private-lessons")
        .catch(() => []),
    ]).then(([s, a, p]) => {
      setSchedule(s ?? []);
      setAssignments(a ?? []);
      setPrivateLessons(p ?? []);
      setLoading(false);
    });
  }, []);

  const today = todayDayOfWeek();
  const todaySchedule = schedule
    .filter((s) => s.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const activeAssignments = assignments.filter((a) =>
    isActiveAssignment(a.due_date),
  );
  const totalStudents = activeAssignments.reduce(
    (sum, a) => sum + a.total_students,
    0,
  );
  const totalCompleted = activeAssignments.reduce(
    (sum, a) => sum + a.completed_count,
    0,
  );
  const completionRate =
    totalStudents > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;

  const weekPrivateLessons = privateLessons.filter(
    (p) => p.status === "scheduled" && isThisWeek(p.scheduled_at),
  );

  const upcomingAssignments = assignments
    .filter((a) => isActiveAssignment(a.due_date))
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    )
    .slice(0, 5);

  const upcomingPrivateLessons = privateLessons
    .filter((p) => new Date(p.scheduled_at) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
    )
    .slice(0, 5);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  /* -- Stat cards ---------------------------------------------------- */
  const stats = [
    {
      label: "Bugünkü Ders",
      value: todaySchedule.length,
      icon: CalendarDays,
      accent: "",
    },
    {
      label: "Bekleyen Yoklama",
      value: todaySchedule.length,
      icon: ClipboardCheck,
      accent: todaySchedule.length > 0 ? "border-l-4 border-l-destructive" : "",
    },
    {
      label: "Aktif Ödev",
      value: `${activeAssignments.length}`,
      sub: totalStudents > 0 ? `%${completionRate} tamamlandı` : undefined,
      icon: ClipboardList,
      accent: "",
    },
    {
      label: "Bu Haftaki Özel Ders",
      value: weekPrivateLessons.length,
      icon: UserCheck,
      accent: "",
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
            <Card className={stat.accent}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">
                      {stat.label}
                    </p>
                    <p className="text-foreground mt-1 text-3xl font-semibold">
                      {stat.value}
                    </p>
                    {stat.sub && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {stat.sub}
                      </p>
                    )}
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
        transition={{ delay: 0.32, duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Bugünün Programı
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaySchedule.length > 0 ? (
              <div className="space-y-2">
                {todaySchedule.map((s, i) => {
                  const color = s.subject_color || "#5B5BD6";
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div
                        className="border-border flex items-center gap-3 rounded-lg border p-3"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: color,
                        }}
                      >
                        <div
                          className="text-foreground text-sm font-medium"
                          style={{ minWidth: 80 }}
                        >
                          {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color }}>
                            {s.subject_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {s.group_name}
                            {s.classroom ? ` · ${s.classroom}` : ""}
                          </p>
                        </div>
                        <Link
                          href="/teacher/attendance"
                          className="text-primary text-xs hover:underline"
                        >
                          Yoklama Al
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Bugün dersiniz yok
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Two-column bottom */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming Assignments */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Yaklaşan Ödevler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAssignments.length > 0 ? (
                <div className="space-y-3">
                  {upcomingAssignments.map((a) => {
                    const rate =
                      a.total_students > 0
                        ? Math.round(
                            (a.completed_count / a.total_students) * 100,
                          )
                        : 0;
                    return (
                      <div key={a.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-foreground truncate text-sm font-medium">
                              {a.title}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {a.group_name} &middot;{" "}
                              {new Date(a.due_date).toLocaleDateString("tr-TR")}
                            </p>
                          </div>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            %{rate}
                          </span>
                        </div>
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-1 text-right">
                    <Link
                      href="/teacher/assignments"
                      className="text-primary text-xs hover:underline"
                    >
                      Tümünü Gör &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Yaklaşan ödev bulunmuyor
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Private Lessons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4" />
                Yaklaşan Özel Dersler
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingPrivateLessons.length > 0 ? (
                <div className="space-y-3">
                  {upcomingPrivateLessons.map((p) => {
                    const s = STATUS_MAP[p.status] ?? {
                      label: p.status,
                      variant: "outline" as const,
                    };
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-medium">
                            {p.student_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(p.scheduled_at).toLocaleDateString(
                              "tr-TR",
                            )}{" "}
                            &middot;{" "}
                            {new Date(p.scheduled_at).toLocaleTimeString(
                              "tr-TR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                    );
                  })}
                  <div className="pt-1 text-right">
                    <Link
                      href="/teacher/private-lessons"
                      className="text-primary text-xs hover:underline"
                    >
                      Tümünü Gör &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Yaklaşan özel ders bulunmuyor
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
