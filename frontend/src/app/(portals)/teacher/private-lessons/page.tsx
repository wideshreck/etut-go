"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { UserCheck, Clock, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PrivateLesson = {
  id: string;
  student_name: string;
  subject_name: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  classroom: string | null;
  notes: string | null;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type FilterTab = "today" | "upcoming" | "past";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "upcoming", label: "Yaklaşan" },
  { value: "past", label: "Geçmiş" },
];

const STATUS_BADGE: Record<
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
  cancelled_by_teacher: { label: "İptal Edildi", variant: "destructive" },
  cancelled_by_student: { label: "İptal Edildi", variant: "destructive" },
  no_show: { label: "Gelmedi", variant: "warning" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isSameDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isUpcoming(dateStr: string, status: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lessonDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return lessonDay > today && status === "scheduled";
}

function isPast(dateStr: string, status: string): boolean {
  return !isSameDay(dateStr) && !isUpcoming(dateStr, status);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeacherPrivateLessonsPage() {
  const [lessons, setLessons] = useState<PrivateLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("today");

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    lessonId: string;
    action: "complete" | "cancel";
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLessons = useCallback(() => {
    api
      .get<PrivateLesson[]>("/api/v1/teacher/private-lessons")
      .then((data) => setLessons(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  function filteredLessons(): PrivateLesson[] {
    switch (activeFilter) {
      case "today":
        return lessons.filter((l) => isSameDay(l.scheduled_at));
      case "upcoming":
        return lessons.filter((l) => isUpcoming(l.scheduled_at, l.status));
      case "past":
        return lessons.filter((l) => isPast(l.scheduled_at, l.status));
      default:
        return lessons;
    }
  }

  async function handleAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.action === "complete") {
        await api.post(
          `/api/v1/teacher/private-lessons/${confirmAction.lessonId}/complete`,
        );
        toast.success("Ders tamamlandı olarak işaretlendi");
      } else {
        await api.post(
          `/api/v1/teacher/private-lessons/${confirmAction.lessonId}/cancel`,
        );
        toast.success("Ders iptal edildi");
      }
      fetchLessons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  const filtered = filteredLessons();

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Özel Dersler</h1>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
              activeFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lesson list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <UserCheck className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground mt-4 text-sm">
            {activeFilter === "today"
              ? "Bugün özel ders bulunmuyor"
              : activeFilter === "upcoming"
                ? "Yaklaşan özel ders bulunmuyor"
                : "Geçmiş özel ders bulunmuyor"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lesson, i) => {
            const badge = STATUS_BADGE[lesson.status] ?? {
              label: lesson.status,
              variant: "outline" as const,
            };
            const isScheduled = lesson.status === "scheduled";
            const initials = lesson.student_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {/* Avatar initials */}
                        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-semibold">
                            {lesson.student_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {lesson.subject_name} &middot;{" "}
                            {new Date(lesson.scheduled_at).toLocaleDateString(
                              "tr-TR",
                            )}{" "}
                            &middot;{" "}
                            {new Date(lesson.scheduled_at).toLocaleTimeString(
                              "tr-TR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                            <Clock className="h-3 w-3" />
                            <span>{lesson.duration_minutes} dk</span>
                            {lesson.classroom && (
                              <>
                                <span>&middot;</span>
                                <span>{lesson.classroom}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {isScheduled && (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  lessonId: lesson.id,
                                  action: "complete",
                                })
                              }
                            >
                              Tamamla
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                setConfirmAction({
                                  lessonId: lesson.id,
                                  action: "cancel",
                                })
                              }
                            >
                              İptal Et
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={() => setConfirmAction(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "complete"
                ? "Dersi Tamamla"
                : "Dersi İptal Et"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "complete"
                ? "Bu dersi tamamlandı olarak işaretlemek istediğinize emin misiniz?"
                : "Bu dersi iptal etmek istediğinize emin misiniz?"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setConfirmAction(null)}
              disabled={actionLoading}
            >
              Vazgeç
            </Button>
            <Button
              variant={
                confirmAction?.action === "cancel" ? "destructive" : "default"
              }
              className="w-full sm:w-auto"
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {confirmAction?.action === "complete" ? "Tamamla" : "İptal Et"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
