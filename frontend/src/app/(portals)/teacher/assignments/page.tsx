"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  FileQuestion,
  FolderKanban,
  BookMarked,
  PenTool,
  ClipboardList,
  Loader2,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Group = {
  id: string;
  name: string;
};

type AssignmentStudent = {
  student_id: string;
  student_name: string;
  is_completed: boolean;
  completed_at: string | null;
  teacher_note: string | null;
};

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  assignment_type: string;
  subject_id: string;
  subject_name: string;
  due_date: string;
  group_id: string | null;
  group_name: string | null;
  total_students: number;
  completed_count: number;
  created_at: string;
};

type ScheduleSlot = {
  id: string;
  subject_id: string;
  subject_name: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ASSIGNMENT_TYPES = [
  { value: "homework", label: "Ev Ödevi", icon: BookOpen },
  { value: "test", label: "Test", icon: FileQuestion },
  { value: "project", label: "Proje", icon: FolderKanban },
  { value: "reading", label: "Okuma", icon: BookMarked },
  { value: "exercise", label: "Alıştırma", icon: PenTool },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSIGNMENT_TYPES.map((t) => [t.value, t.label]),
);

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("create");

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [groupId, setGroupId] = useState("");
  const [assignmentType, setAssignmentType] = useState("homework");
  const [subjectId, setSubjectId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [creating, setCreating] = useState(false);

  // Detail dialog state
  const [detailAssignment, setDetailAssignment] = useState<Assignment | null>(
    null,
  );
  const [assignmentStudents, setAssignmentStudents] = useState<
    AssignmentStudent[]
  >([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingStudentIds, setSavingStudentIds] = useState<Set<string>>(
    new Set(),
  );

  const fetchAssignments = useCallback(() => {
    api
      .get<Assignment[]>("/api/v1/teacher/assignments")
      .then((data) => setAssignments(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAssignments();
    api
      .get<Group[]>("/api/v1/teacher/groups")
      .then((data) => setGroups(data ?? []))
      .catch(() => {});
    // Get teacher's subject from schedule
    api
      .get<ScheduleSlot[]>("/api/v1/teacher/schedule")
      .then((data) => {
        const slots = data ?? [];
        const first = slots[0];
        if (slots.length > 0 && first) {
          setSubjectId(first.subject_id);
          setSubjectName(first.subject_name);
        }
      })
      .catch(() => {});
  }, [fetchAssignments]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!groupId || !subjectId) {
      toast.error("Lütfen grup ve branş seçin");
      return;
    }
    setCreating(true);
    try {
      await api.post("/api/v1/teacher/assignments", {
        title,
        description: description || null,
        assignment_type: assignmentType,
        subject_id: subjectId,
        due_date: dueDate,
        group_id: groupId,
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setGroupId("");
      setAssignmentType("homework");
      toast.success("Ödev başarıyla oluşturuldu");
      fetchAssignments();
      setActiveTab("track");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setCreating(false);
    }
  }

  async function openDetail(assignment: Assignment) {
    setDetailAssignment(assignment);
    setDetailLoading(true);
    try {
      const data = await api.get<AssignmentStudent[]>(
        `/api/v1/teacher/assignments/${assignment.id}/students`,
      );
      setAssignmentStudents(data);
    } catch {
      setAssignmentStudents([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailAssignment(null);
    setAssignmentStudents([]);
  }

  async function toggleCompletion(studentId: string, currentStatus: boolean) {
    if (!detailAssignment) return;
    setSavingStudentIds((prev) => new Set([...prev, studentId]));
    try {
      await api.put(
        `/api/v1/teacher/assignments/${detailAssignment.id}/status`,
        {
          student_id: studentId,
          is_completed: !currentStatus,
        },
      );
      setAssignmentStudents((prev) =>
        prev.map((s) =>
          s.student_id === studentId
            ? { ...s, is_completed: !currentStatus }
            : s,
        ),
      );
      // Update local assignments state
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === detailAssignment.id
            ? {
                ...a,
                completed_count: a.completed_count + (currentStatus ? -1 : 1),
              }
            : a,
        ),
      );
    } catch {
      toast.error("Durum güncellenemedi");
    } finally {
      setSavingStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  }

  async function completeAll() {
    if (!detailAssignment) return;
    const incomplete = assignmentStudents.filter((s) => !s.is_completed);
    for (const s of incomplete) {
      await api
        .put(`/api/v1/teacher/assignments/${detailAssignment.id}/status`, {
          student_id: s.student_id,
          is_completed: true,
        })
        .catch(() => {});
    }
    setAssignmentStudents((prev) =>
      prev.map((s) => ({ ...s, is_completed: true })),
    );
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === detailAssignment.id
          ? { ...a, completed_count: a.total_students }
          : a,
      ),
    );
    toast.success("Tüm öğrenciler tamamlandı olarak işaretlendi");
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Ödevler</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create">Ödev Ver</TabsTrigger>
          <TabsTrigger value="track">Takip Et</TabsTrigger>
        </TabsList>

        {/* ── Ödev Ver ─────────────────────────────────────────────── */}
        <TabsContent value="create">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleCreate} className="space-y-5">
                  {/* Group select */}
                  <div className="space-y-2">
                    <Label>Sınıf</Label>
                    <Select value={groupId} onValueChange={setGroupId}>
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

                  {/* Subject (auto-filled) */}
                  {subjectName && (
                    <div className="space-y-2">
                      <Label>Branş</Label>
                      <Input value={subjectName} disabled />
                    </div>
                  )}

                  {/* Assignment type selector */}
                  <div className="space-y-2">
                    <Label>Ödev Tipi</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {ASSIGNMENT_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isActive = assignmentType === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setAssignmentType(t.value)}
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all",
                              isActive
                                ? "border-primary bg-primary/5 text-primary"
                                : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label>Başlık</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ödev başlığı"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label>Açıklama</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Ödev açıklaması (isteğe bağlı)"
                    />
                  </div>

                  {/* Due date */}
                  <div className="space-y-2">
                    <Label>Son Tarih</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={creating}>
                      {creating && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Oluştur
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Takip Et ─────────────────────────────────────────────── */}
        <TabsContent value="track">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {assignments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <ClipboardList className="text-muted-foreground/50 h-12 w-12" />
                <p className="text-muted-foreground mt-4 text-sm">
                  Henüz ödev bulunmuyor
                </p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {assignments.map((a, i) => {
                  const rate =
                    a.total_students > 0
                      ? Math.round((a.completed_count / a.total_students) * 100)
                      : 0;
                  const typeLabel =
                    TYPE_LABELS[a.assignment_type] ?? a.assignment_type;
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                    >
                      <Card
                        className="hover:border-primary/30 cursor-pointer transition-colors"
                        onClick={() => openDetail(a)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <h3 className="text-foreground truncate text-sm font-semibold">
                                  {a.title}
                                </h3>
                                <Badge variant="secondary">{typeLabel}</Badge>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {a.group_name} &middot; Son tarih:{" "}
                                {new Date(a.due_date).toLocaleDateString(
                                  "tr-TR",
                                )}
                              </p>
                            </div>
                            <span className="text-muted-foreground shrink-0 text-sm font-medium">
                              {a.completed_count}/{a.total_students}
                            </span>
                          </div>
                          <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!detailAssignment} onOpenChange={() => closeDetail()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailAssignment?.title}</DialogTitle>
          </DialogHeader>

          {detailAssignment && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {TYPE_LABELS[detailAssignment.assignment_type] ??
                    detailAssignment.assignment_type}
                </Badge>
                {detailAssignment.group_name && (
                  <Badge variant="outline">{detailAssignment.group_name}</Badge>
                )}
                <Badge variant="outline">
                  Son:{" "}
                  {new Date(detailAssignment.due_date).toLocaleDateString(
                    "tr-TR",
                  )}
                </Badge>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                </div>
              ) : assignmentStudents.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  Öğrenci bilgisi bulunamadı
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {assignmentStudents.map((s, i) => (
                      <motion.div
                        key={s.student_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                        className="bg-muted flex items-center justify-between rounded-lg p-3"
                      >
                        <span className="text-foreground text-sm font-medium">
                          {s.student_name}
                        </span>
                        <button
                          onClick={() =>
                            toggleCompletion(s.student_id, s.is_completed)
                          }
                          disabled={savingStudentIds.has(s.student_id)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                            s.is_completed
                              ? "border-success/20 bg-success/10 text-success"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {savingStudentIds.has(s.student_id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : s.is_completed ? (
                            <Check className="h-3 w-3" />
                          ) : null}
                          {s.is_completed ? "Tamamlandı" : "Tamamlanmadı"}
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  {assignmentStudents.some((s) => !s.is_completed) && (
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={completeAll}>
                        Tümünü Tamamla
                      </Button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
