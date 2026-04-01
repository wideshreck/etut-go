"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "motion/react";
import { BookOpen, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CreditInfo = {
  weekly_credits: number;
  remaining_this_week: number;
  credit_duration: number;
};

type AvailableSlot = {
  teacher_id: string;
  teacher_name: string;
  subject_id: string | null;
  subject_name: string;
  date: string;
  start_time: string;
  end_time: string;
};

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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StudentPrivateLessonsPage() {
  const [activeTab, setActiveTab] = useState("book");

  /* Credits */
  const [credits, setCredits] = useState<CreditInfo | null>(null);

  /* Booking tab state */
  const [selectedDate, setSelectedDate] = useState(getTomorrow());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  /* Book dialog */
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookNote, setBookNote] = useState("");
  const [booking, setBooking] = useState(false);

  /* My lessons tab */
  const [lessons, setLessons] = useState<PrivateLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                    */
  /* ---------------------------------------------------------------- */

  const fetchCredits = useCallback(() => {
    api
      .get<CreditInfo>("/api/v1/student/credits")
      .then((data) => setCredits(data ?? null))
      .catch(() => {});
  }, []);

  const fetchSlots = useCallback((date: string) => {
    setLoadingSlots(true);
    api
      .get<AvailableSlot[]>(
        `/api/v1/student/available-slots?target_date=${date}`,
      )
      .then((data) => setSlots(data ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, []);

  const fetchLessons = useCallback(() => {
    setLoadingLessons(true);
    api
      .get<PrivateLesson[]>("/api/v1/student/private-lessons")
      .then((data) => setLessons(data ?? []))
      .catch(() => {})
      .finally(() => setLoadingLessons(false));
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchLessons();
  }, [fetchCredits, fetchLessons]);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */

  function openBookDialog(slot: AvailableSlot) {
    if (credits && credits.remaining_this_week <= 0) return;
    setSelectedSlot(slot);
    setBookNote("");
  }

  async function handleBook() {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      const scheduledAt = `${selectedSlot.date}T${selectedSlot.start_time}:00`;
      await api.post("/api/v1/student/private-lessons/book", {
        teacher_id: selectedSlot.teacher_id,
        subject_id: selectedSlot.subject_id,
        scheduled_at: scheduledAt,
        notes: bookNote || null,
      });
      toast.success("Ders başarıyla oluşturuldu");
      setSelectedSlot(null);
      setBookNote("");
      fetchCredits();
      fetchSlots(selectedDate);
      fetchLessons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(lessonId: string) {
    setCancellingId(lessonId);
    try {
      await api.post(`/api/v1/student/private-lessons/${lessonId}/cancel`);
      toast.success("Ders iptal edildi");
      fetchLessons();
      fetchCredits();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "İptal işlemi başarısız oldu",
      );
    } finally {
      setCancellingId(null);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  const noCredits = credits != null && credits.remaining_this_week <= 0;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-xl font-semibold sm:text-2xl">
        Özel Dersler
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="book" className="flex-1 sm:flex-initial">
            Ders Al
          </TabsTrigger>
          <TabsTrigger value="my" className="flex-1 sm:flex-initial">
            Derslerim
          </TabsTrigger>
        </TabsList>

        {/* ======== Tab 1 — Ders Al ======== */}
        <TabsContent value="book">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Credit info card */}
            {credits && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-l-primary border-l-4">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Bu Hafta Kalan Krediniz
                      </p>
                      <p className="text-foreground text-2xl font-semibold">
                        {credits.remaining_this_week} / {credits.weekly_credits}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {credits.credit_duration} dk / ders
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {noCredits && (
              <p className="text-destructive text-sm">
                Bu hafta için krediniz kalmadı. Yeni ders alamazsınız.
              </p>
            )}

            {/* Date picker */}
            <div className="space-y-2">
              <label className="text-foreground text-sm font-medium">
                Tarih Seçin
              </label>
              <Input
                type="date"
                value={selectedDate}
                min={getToday()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-[220px]"
              />
            </div>

            {/* Slots */}
            {loadingSlots ? (
              <p className="text-muted-foreground text-sm">
                Müsait saatler yükleniyor...
              </p>
            ) : slots.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarX className="text-muted-foreground mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Bu tarihte müsait ders saati bulunmuyor
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {slots.map((slot, i) => (
                  <motion.div
                    key={`${slot.teacher_id}-${slot.start_time}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                  >
                    <Card
                      className={`transition-all ${
                        noCredits
                          ? "cursor-not-allowed opacity-50"
                          : "hover:border-primary/50 cursor-pointer"
                      }`}
                      onClick={() => !noCredits && openBookDialog(slot)}
                    >
                      <CardContent className="p-3">
                        <p className="text-foreground text-sm font-medium">
                          {slot.teacher_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {slot.subject_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {slot.start_time} – {slot.end_time}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* ======== Tab 2 — Derslerim ======== */}
        <TabsContent value="my">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {loadingLessons ? (
              <p className="text-muted-foreground text-sm">Yükleniyor...</p>
            ) : lessons.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="text-muted-foreground mb-3 h-10 w-10" />
                    <p className="text-muted-foreground text-sm">
                      Henüz özel ders bulunmuyor
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              lessons.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground text-sm font-medium">
                            {l.teacher_name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {l.subject_name}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {new Date(l.scheduled_at).toLocaleString("tr-TR")} ·{" "}
                            {l.duration_minutes} dk
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant={STATUS_VARIANTS[l.status] ?? "outline"}
                          >
                            {STATUS_LABELS[l.status] ?? l.status}
                          </Badge>
                          {l.status === "scheduled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={cancellingId === l.id}
                              onClick={() => handleCancel(l.id)}
                            >
                              {cancellingId === l.id
                                ? "İptal ediliyor..."
                                : "İptal Et"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Booking Confirmation Dialog */}
      <Dialog
        open={!!selectedSlot}
        onOpenChange={(open) => !open && setSelectedSlot(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {selectedSlot && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle>Ders Onayla</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Öğretmen</span>
                  <span className="text-foreground">
                    {selectedSlot.teacher_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branş</span>
                  <span className="text-foreground">
                    {selectedSlot.subject_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarih</span>
                  <span className="text-foreground">
                    {formatDateTR(selectedSlot.date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saat</span>
                  <span className="text-foreground">
                    {selectedSlot.start_time} – {selectedSlot.end_time}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <Textarea
                  placeholder="Not (isteğe bağlı)"
                  value={bookNote}
                  onChange={(e) => setBookNote(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedSlot(null)}>
                  İptal
                </Button>
                <Button onClick={handleBook} disabled={booking}>
                  {booking ? "Kaydediliyor..." : "Dersi Onayla"}
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
