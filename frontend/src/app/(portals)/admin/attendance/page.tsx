"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AttendanceSummary = {
  student_id: string;
  student_name: string;
  total_lessons: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
};

type ScheduleSlot = {
  id: string;
  group_id: string;
  group_name: string;
  subject_name: string;
  teacher_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type GroupOption = { id: string; name: string };
type StudentOption = { id: string; full_name: string };

type AttendanceEntry = {
  student_id: string;
  status: string;
  note: string;
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

const STATUS_COLORS: Record<string, string> = {
  present: "bg-success/10 text-success border-success/20",
  absent: "bg-destructive/10 text-destructive border-destructive/20",
  late: "bg-warning/10 text-warning border-warning/20",
  excused: "bg-muted text-muted-foreground border-border",
};

const DAY_NAMES: Record<number, string> = {
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
  7: "Paz",
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState("take");

  /* ---- Shared ---- */
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");

  /* ---- Take Attendance ---- */
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>({});
  const [submitting, setSubmitting] = useState(false);

  /* ---- Summary ---- */
  const [summaryGroup, setSummaryGroup] = useState("");
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetch groups on mount                                            */
  /* ---------------------------------------------------------------- */

  const fetchGroups = useCallback(() => {
    api
      .get<GroupOption[]>("/api/v1/admin/groups")
      .then((data) => setGroups(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  /* ---------------------------------------------------------------- */
  /*  Take mode: fetch schedules when group selected                   */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedGroup) {
      setSchedules([]);
      setSelectedSchedule("");
      setStudents([]);
      setEntries({});
      return;
    }
    api
      .get<ScheduleSlot[]>(`/api/v1/admin/schedules?group_id=${selectedGroup}`)
      .then((res) => {
        const data = res ?? [];
        setSchedules(data);
        setSelectedSchedule("");
      })
      .catch(() => setSchedules([]));
  }, [selectedGroup]);

  /* ---------------------------------------------------------------- */
  /*  Take mode: fetch students when group selected                    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedGroup) return;
    api
      .get<StudentOption[]>(`/api/v1/admin/students?group_id=${selectedGroup}`)
      .then((res) => {
        const data = res ?? [];
        setStudents(data);
        const init: Record<string, AttendanceEntry> = {};
        data.forEach((s) => {
          init[s.id] = { student_id: s.id, status: "present", note: "" };
        });
        setEntries(init);
      })
      .catch(() => {
        setStudents([]);
        setEntries({});
      });
  }, [selectedGroup]);

  /* ---------------------------------------------------------------- */
  /*  Summary mode: fetch when group selected                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!summaryGroup) {
      setSummaries([]);
      return;
    }
    setLoadingSummary(true);
    api
      .get<AttendanceSummary[]>(
        `/api/v1/admin/attendance/summary?group_id=${summaryGroup}`,
      )
      .then((data) => setSummaries(data ?? []))
      .catch(() => setSummaries([]))
      .finally(() => setLoadingSummary(false));
  }, [summaryGroup]);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  function updateStatus(studentId: string, status: string) {
    setEntries((prev) => {
      const existing = prev[studentId] ?? {
        student_id: studentId,
        status: "present",
        note: "",
      };
      return { ...prev, [studentId]: { ...existing, status } };
    });
  }

  function updateNote(studentId: string, note: string) {
    setEntries((prev) => {
      const existing = prev[studentId] ?? {
        student_id: studentId,
        status: "present",
        note: "",
      };
      return { ...prev, [studentId]: { ...existing, note } };
    });
  }

  function formatSlot(slot: ScheduleSlot) {
    return `${slot.subject_name} - ${DAY_NAMES[slot.day_of_week]} ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)}`;
  }

  function rateColor(rate: number) {
    if (rate >= 80) return "text-success";
    if (rate >= 60) return "text-warning";
    return "text-destructive";
  }

  /* ---------------------------------------------------------------- */
  /*  Submit attendance                                                */
  /* ---------------------------------------------------------------- */

  async function handleSubmit() {
    if (!selectedSchedule || !date) {
      toast.error("Lütfen ders ve tarih seçin");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/v1/admin/attendance", {
        schedule_id: selectedSchedule,
        date,
        entries: Object.values(entries).map((e) => ({
          student_id: e.student_id,
          status: e.status,
          note: e.note || null,
        })),
      });
      toast.success("Yoklama başarıyla kaydedildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-xl font-semibold sm:text-2xl">
        Yoklama
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="take">Yoklama Al</TabsTrigger>
          <TabsTrigger value="summary">Özet</TabsTrigger>
        </TabsList>

        {/* ======== Tab 1 — Yoklama Al ======== */}
        <TabsContent value="take">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1 sm:w-[200px]">
                <span className="text-muted-foreground text-sm">Sınıf</span>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sınıf seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedGroup && schedules.length > 0 && (
                <div className="space-y-1 sm:w-[280px]">
                  <span className="text-muted-foreground text-sm">Ders</span>
                  <Select
                    value={selectedSchedule}
                    onValueChange={setSelectedSchedule}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ders seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {schedules.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatSlot(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedGroup && (
                <div className="space-y-1 sm:w-[160px]">
                  <span className="text-muted-foreground text-sm">Tarih</span>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Student list */}
            {!selectedGroup && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Sınıf seçerek yoklama almaya başlayın
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {selectedGroup && students.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Bu sınıfta henüz öğrenci yok
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {selectedGroup && students.length > 0 && (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {students.map((student, i) => {
                    const entry = entries[student.id];
                    if (!entry) return null;
                    return (
                      <motion.div
                        key={student.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className="border-border space-y-2 rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-foreground text-sm font-medium">
                            {student.full_name}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(STATUS_LABELS).map(
                              ([value, label]) => (
                                <Button
                                  key={value}
                                  variant={
                                    entry.status === value
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  className={
                                    entry.status === value
                                      ? STATUS_COLORS[value]
                                      : ""
                                  }
                                  onClick={() =>
                                    updateStatus(student.id, value)
                                  }
                                >
                                  {label}
                                </Button>
                              ),
                            )}
                          </div>
                        </div>
                        <Input
                          placeholder="Not (isteğe bağlı)"
                          value={entry.note}
                          onChange={(e) =>
                            updateNote(student.id, e.target.value)
                          }
                          className="text-sm"
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !selectedSchedule}
                  >
                    {submitting ? "Kaydediliyor..." : "Yoklamayı Kaydet"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ======== Tab 2 — Özet ======== */}
        <TabsContent value="summary">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1 sm:w-[200px]">
                <span className="text-muted-foreground text-sm">Sınıf</span>
                <Select value={summaryGroup} onValueChange={setSummaryGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sınıf seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!summaryGroup && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Özet görüntülemek için sınıf seçin
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {summaryGroup && loadingSummary && (
              <div className="text-muted-foreground">Yükleniyor...</div>
            )}

            {summaryGroup && !loadingSummary && summaries.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Bu sınıf için henüz yoklama verisi yok
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {summaryGroup && !loadingSummary && summaries.length > 0 && (
              <>
                {/* Desktop Table */}
                <Card className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ad Soyad</TableHead>
                        <TableHead className="text-center">
                          Toplam Ders
                        </TableHead>
                        <TableHead className="text-center">Geldi</TableHead>
                        <TableHead className="text-center">Gelmedi</TableHead>
                        <TableHead className="text-center">Geç Kaldı</TableHead>
                        <TableHead className="text-center">İzinli</TableHead>
                        <TableHead className="text-center">
                          Katılım Oranı (%)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.map((s, i) => (
                        <motion.tr
                          key={s.student_id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.25 }}
                          className="border-b"
                        >
                          <TableCell className="font-medium">
                            {s.student_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-center">
                            {s.total_lessons}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="success">{s.present}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive">{s.absent}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="warning">{s.late}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{s.excused}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`font-semibold ${rateColor(s.attendance_rate)}`}
                            >
                              %{(s.attendance_rate ?? 0).toFixed(0)}
                            </span>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </Card>

                {/* Mobile Card List */}
                <div className="space-y-3 md:hidden">
                  {summaries.map((s, i) => (
                    <motion.div
                      key={s.student_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                    >
                      <Card>
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-foreground text-sm font-medium">
                              {s.student_name}
                            </span>
                            <span
                              className={`text-sm font-semibold ${rateColor(s.attendance_rate)}`}
                            >
                              %{(s.attendance_rate ?? 0).toFixed(0)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">
                                Toplam:
                              </span>
                              <span className="text-foreground font-medium">
                                {s.total_lessons}
                              </span>
                            </div>
                            <Badge variant="success">Geldi: {s.present}</Badge>
                            <Badge variant="destructive">
                              Gelmedi: {s.absent}
                            </Badge>
                            <Badge variant="warning">Geç: {s.late}</Badge>
                            <Badge variant="secondary">
                              İzinli: {s.excused}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
