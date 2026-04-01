"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
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

type Teacher = { id: string; full_name: string };
type Student = { id: string; full_name: string };

type PrivateLesson = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  student_id: string;
  student_name: string;
  subject_id: string;
  subject_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  classroom: string | null;
  notes: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled_by_student: "Öğrenci İptal",
  cancelled_by_teacher: "Öğretmen İptal",
  no_show: "Gelmedi",
};

const STATUS_VARIANTS: Record<
  string,
  "secondary" | "success" | "destructive" | "warning" | "outline"
> = {
  scheduled: "secondary",
  completed: "success",
  cancelled_by_student: "destructive",
  cancelled_by_teacher: "destructive",
  no_show: "warning",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PrivateLessonsPage() {
  const [lessons, setLessons] = useState<PrivateLesson[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  /* filters */
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  /* ---------------------------------------------------------------- */
  /*  Fetch                                                            */
  /* ---------------------------------------------------------------- */

  const fetchLessons = useCallback(
    (studentId?: string, teacherId?: string, status?: string) => {
      const params = new URLSearchParams();
      if (studentId && studentId !== "all") params.set("student_id", studentId);
      if (teacherId && teacherId !== "all") params.set("teacher_id", teacherId);
      if (status && status !== "all") params.set("status", status);
      const query = params.toString();
      api
        .get<PrivateLesson[]>(
          `/api/v1/admin/private-lessons${query ? `?${query}` : ""}`,
        )
        .then((data) => setLessons(data ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    fetchLessons();
    api
      .get<Teacher[]>("/api/v1/admin/teachers")
      .then((data) => setTeachers(data ?? []))
      .catch(() => {});
    api
      .get<Student[]>("/api/v1/admin/students")
      .then((data) => setStudents(data ?? []))
      .catch(() => {});
  }, [fetchLessons]);

  /* debounced filters */
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchLessons(filterStudent, filterTeacher, filterStatus);
    }, 300);
    return () => clearTimeout(timeout);
  }, [filterStudent, filterTeacher, filterStatus, fetchLessons]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-foreground text-xl font-semibold sm:text-2xl">
        Özel Dersler
      </h1>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={filterStudent} onValueChange={setFilterStudent}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tüm Öğrenciler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Öğrenciler</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTeacher} onValueChange={setFilterTeacher}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tüm Öğretmenler" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Öğretmenler</SelectItem>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tüm Durumlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {lessons.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UserCheck className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                Henüz özel ders bulunmuyor
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Öğrenci</TableHead>
                  <TableHead>Öğretmen</TableHead>
                  <TableHead>Branş</TableHead>
                  <TableHead>Tarih / Saat</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((l, i) => (
                  <motion.tr
                    key={l.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    whileHover={{ backgroundColor: "var(--color-muted)" }}
                    className="cursor-pointer border-b transition-colors"
                  >
                    <TableCell className="font-medium">
                      {l.student_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.teacher_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.subject_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(l.scheduled_at).toLocaleString("tr-TR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.duration_minutes} dk
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[l.status] ?? "outline"}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-3 md:hidden">
            {lessons.map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {l.student_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {l.teacher_name} · {l.subject_name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {new Date(l.scheduled_at).toLocaleString("tr-TR")} ·{" "}
                          {l.duration_minutes} dk
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANTS[l.status] ?? "outline"}>
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
