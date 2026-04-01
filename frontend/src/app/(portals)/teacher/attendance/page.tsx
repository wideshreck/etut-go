"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

type Student = {
  id: string;
  full_name: string;
  email: string;
};

type AttendanceEntry = {
  student_id: string;
  status: string;
  note: string | null;
};

type HistoryRecord = {
  id: string;
  date: string;
  student_name: string;
  subject_name: string;
  group_name: string;
  status: string;
  note: string | null;
};

type TeacherGroup = {
  id: string;
  name: string;
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

const STATUS_OPTIONS = [
  {
    value: "present",
    label: "Geldi",
    color: "bg-success/10 text-success border-success/20",
  },
  {
    value: "absent",
    label: "Gelmedi",
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
  {
    value: "late",
    label: "Geç Kaldı",
    color: "bg-warning/10 text-warning border-warning/20",
  },
  {
    value: "excused",
    label: "İzinli",
    color: "bg-muted text-muted-foreground border-border",
  },
];

function todayDayOfWeek(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeacherAttendancePage() {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [entries, setEntries] = useState<Record<string, AttendanceEntry>>({});
  const [saving, setSaving] = useState(false);
  const [savedSlots, setSavedSlots] = useState<Set<string>>(new Set());

  // History state
  const [historyDateFrom, setHistoryDateFrom] = useState(todayDateStr());
  const [historyDateTo, setHistoryDateTo] = useState(todayDateStr());
  const [historyGroupId, setHistoryGroupId] = useState("all");
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<ScheduleSlot[]>("/api/v1/teacher/schedule"),
      api.get<TeacherGroup[]>("/api/v1/teacher/groups").catch(() => []),
    ])
      .then(([s, g]) => {
        setSchedule(s ?? []);
        setTeacherGroups(g ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchHistory = useCallback(() => {
    setHistoryLoading(true);
    const params = new URLSearchParams();
    if (historyDateFrom) params.set("date_from", historyDateFrom);
    if (historyDateTo) params.set("date_to", historyDateTo);
    if (historyGroupId && historyGroupId !== "all")
      params.set("group_id", historyGroupId);
    api
      .get<HistoryRecord[]>(
        `/api/v1/teacher/attendance/history?${params.toString()}`,
      )
      .then((data) => setHistoryRecords(data ?? []))
      .catch(() => setHistoryRecords([]))
      .finally(() => setHistoryLoading(false));
  }, [historyDateFrom, historyDateTo, historyGroupId]);

  const today = todayDayOfWeek();
  const todaySlots = schedule
    .filter((s) => s.day_of_week === today)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const expandSlot = useCallback(
    async (slot: ScheduleSlot) => {
      if (expandedSlotId === slot.id) {
        setExpandedSlotId(null);
        setStudents([]);
        setEntries({});
        return;
      }
      setExpandedSlotId(slot.id);
      setStudentsLoading(true);
      try {
        const data = await api.get<Student[]>(
          `/api/v1/teacher/groups/${slot.group_id}/students`,
        );
        setStudents(data);
        const initialEntries: Record<string, AttendanceEntry> = {};
        for (const s of data) {
          initialEntries[s.id] = {
            student_id: s.id,
            status: "present",
            note: null,
          };
        }
        setEntries(initialEntries);
      } catch {
        setStudents([]);
        setEntries({});
      } finally {
        setStudentsLoading(false);
      }
    },
    [expandedSlotId],
  );

  function setStudentStatus(studentId: string, status: string) {
    setEntries((prev) => {
      const existing = prev[studentId];
      if (!existing) return prev;
      return { ...prev, [studentId]: { ...existing, status } };
    });
  }

  async function saveAttendance() {
    if (!expandedSlotId) return;
    setSaving(true);
    try {
      await api.post("/api/v1/teacher/attendance", {
        schedule_id: expandedSlotId,
        date: todayDateStr(),
        entries: Object.values(entries),
      });
      toast.success("Yoklama başarıyla kaydedildi");
      setSavedSlots((prev) => new Set([...prev, expandedSlotId]));
      setExpandedSlotId(null);
      setStudents([]);
      setEntries({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yoklama kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Yoklama</h1>

      <Tabs defaultValue="take">
        <TabsList>
          <TabsTrigger value="take">Yoklama Al</TabsTrigger>
          <TabsTrigger value="history">Geçmiş</TabsTrigger>
        </TabsList>

        {/* ── Yoklama Al ───────────────────────────────────────────── */}
        <TabsContent value="take">
          {todaySlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardCheck className="text-muted-foreground/50 h-12 w-12" />
              <p className="text-muted-foreground mt-4 text-sm">
                Bugün dersiniz bulunmuyor
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaySlots.map((slot, i) => {
                const color = slot.subject_color || "#5B5BD6";
                const isExpanded = expandedSlotId === slot.id;
                const isSaved = savedSlots.has(slot.id);

                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                  >
                    <Card>
                      <button
                        onClick={() => expandSlot(slot)}
                        className="flex w-full items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-1 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <p
                              className="text-sm font-semibold"
                              style={{ color }}
                            >
                              {slot.subject_name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {slot.start_time.slice(0, 5)} –{" "}
                              {slot.end_time.slice(0, 5)} &middot;{" "}
                              {slot.group_name}
                              {slot.classroom ? ` · ${slot.classroom}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSaved ? (
                            <Badge variant="success">Yoklama Alındı</Badge>
                          ) : (
                            <Badge variant="warning">Bekliyor</Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground h-4 w-4" />
                          ) : (
                            <ChevronDown className="text-muted-foreground h-4 w-4" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <CardContent className="border-border border-t pt-4">
                              {studentsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                                </div>
                              ) : students.length === 0 ? (
                                <p className="text-muted-foreground py-4 text-center text-sm">
                                  Bu grupta öğrenci bulunmuyor
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  <div className="flex justify-end">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEntries((prev) => {
                                          const next = { ...prev };
                                          students.forEach((s) => {
                                            next[s.id] = {
                                              student_id: s.id,
                                              status: "present",
                                              note: null,
                                            };
                                          });
                                          return next;
                                        });
                                      }}
                                    >
                                      Tümünü Geldi İşaretle
                                    </Button>
                                  </div>
                                  {students.map((student) => {
                                    const entry = entries[student.id];
                                    return (
                                      <div
                                        key={student.id}
                                        className="border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-foreground truncate text-sm font-medium">
                                            {student.full_name}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {STATUS_OPTIONS.map((opt) => (
                                            <button
                                              key={opt.value}
                                              onClick={() =>
                                                setStudentStatus(
                                                  student.id,
                                                  opt.value,
                                                )
                                              }
                                              className={cn(
                                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                                                entry?.status === opt.value
                                                  ? opt.color
                                                  : "border-border bg-background text-muted-foreground hover:bg-muted",
                                              )}
                                            >
                                              {entry?.status === opt.value && (
                                                <Check className="mr-1 inline h-3 w-3" />
                                              )}
                                              {opt.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  <div className="flex justify-end pt-2">
                                    <Button
                                      onClick={saveAttendance}
                                      disabled={saving}
                                    >
                                      {saving && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Yoklamayı Kaydet
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Geçmiş ───────────────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">
                  Başlangıç
                </label>
                <Input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="w-auto"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">Bitiş</label>
                <Input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="w-auto"
                />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">Sınıf</label>
                <Select
                  value={historyGroupId}
                  onValueChange={setHistoryGroupId}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tümü" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    {teacherGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchHistory} disabled={historyLoading}>
                {historyLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Getir
              </Button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ClipboardCheck className="text-muted-foreground/50 h-10 w-10" />
                <p className="text-muted-foreground mt-3 text-sm">
                  Seçili tarih aralığında yoklama kaydı bulunamadı
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyRecords.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                  >
                    <Card>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {r.student_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(r.date).toLocaleDateString("tr-TR")}{" "}
                            &middot; {r.subject_name} &middot; {r.group_name}
                          </p>
                        </div>
                        <Badge
                          variant={STATUS_VARIANTS[r.status] ?? "secondary"}
                        >
                          {STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
