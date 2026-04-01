"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { Timetable, type ScheduleSlot } from "@/components/schedule/timetable";
import { motion } from "motion/react";

type FullScheduleSlot = ScheduleSlot & {
  group_id: string;
  group_name: string;
  subject_id: string;
  teacher_id: string;
};

type Group = { id: string; name: string };
type Subject = { id: string; name: string; color_code: string | null };
type Teacher = { id: string; full_name: string; subject_id: string | null };

const DAY_OPTIONS = [
  { value: "1", label: "Pazartesi" },
  { value: "2", label: "Salı" },
  { value: "3", label: "Çarşamba" },
  { value: "4", label: "Perşembe" },
  { value: "5", label: "Cuma" },
  { value: "6", label: "Cumartesi" },
];

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<FullScheduleSlot[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  /* Filter */
  const [selectedGroupId, setSelectedGroupId] = useState("all");

  /* Dialog */
  const [showForm, setShowForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<FullScheduleSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Form fields */
  const [groupId, setGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [classroom, setClassroom] = useState("");

  /* Delete */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSchedules = useCallback(() => {
    const query =
      selectedGroupId !== "all" ? `?group_id=${selectedGroupId}` : "";
    api
      .get<FullScheduleSlot[]>(`/api/v1/admin/schedules${query}`)
      .then((data) => setSchedules(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedGroupId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    Promise.all([
      api.get<Group[]>("/api/v1/admin/groups").catch(() => []),
      api.get<Subject[]>("/api/v1/admin/subjects").catch(() => []),
      api.get<Teacher[]>("/api/v1/admin/teachers").catch(() => []),
    ]).then(([g, s, t]) => {
      setGroups(g ?? []);
      setSubjects(s ?? []);
      setTeachers(t ?? []);
    });
  }, []);

  function resetForm() {
    setGroupId("");
    setSubjectId("");
    setTeacherId("");
    setDayOfWeek("");
    setStartTime("");
    setEndTime("");
    setClassroom("");
    setEditingSlot(null);
  }

  function openEdit(slot: ScheduleSlot) {
    const full = slot as FullScheduleSlot;
    setEditingSlot(full);
    setGroupId(full.group_id);
    setSubjectId(full.subject_id);
    setTeacherId(full.teacher_id);
    setDayOfWeek(String(full.day_of_week));
    setStartTime(full.start_time.slice(0, 5));
    setEndTime(full.end_time.slice(0, 5));
    setClassroom(full.classroom || "");
    setShowForm(true);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        group_id: groupId,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        classroom: classroom || null,
      };
      if (editingSlot) {
        await api.put(`/api/v1/admin/schedules/${editingSlot.id}`, payload);
        toast.success("Ders başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/schedules", payload);
        toast.success("Ders başarıyla eklendi");
      }
      resetForm();
      setShowForm(false);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/schedules/${deleteId}`);
      toast.success("Ders başarıyla silindi");
      setDeleteId(null);
      setShowForm(false);
      setEditingSlot(null);
      fetchSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="text-foreground text-2xl font-semibold">
          Ders Programı
        </h1>
        <div className="flex items-center gap-3">
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tüm Sınıflar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Sınıflar</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Ders Ekle
          </Button>
        </div>
      </motion.div>

      {/* Timetable */}
      <Timetable schedules={schedules} onSlotClick={openEdit} />

      {/* Create / Edit Dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowForm(open);
        }}
      >
        <DialogContent>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingSlot ? "Dersi Düzenle" : "Yeni Ders"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Sınıf</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
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
              <div className="space-y-2">
                <Label>Branş</Label>
                <Select
                  value={subjectId}
                  onValueChange={(v) => {
                    setSubjectId(v);
                    setTeacherId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Öğretmen</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={subjectId ? "Seçin" : "Önce branş seçin"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers
                      .filter((t) => !subjectId || t.subject_id === subjectId)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name}
                        </SelectItem>
                      ))}
                    {subjectId &&
                      teachers.filter((t) => t.subject_id === subjectId)
                        .length === 0 && (
                        <div className="text-muted-foreground px-3 py-2 text-sm">
                          Bu branşta öğretmen yok
                        </div>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gün</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Başlangıç</Label>
                  <TimePicker value={startTime} onChange={setStartTime} />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <TimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Derslik</Label>
                <Input
                  value={classroom}
                  onChange={(e) => setClassroom(e.target.value)}
                  placeholder="Örn: A-201"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  {editingSlot && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(editingSlot.id)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Sil
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                  >
                    İptal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting
                      ? "Kaydediliyor..."
                      : editingSlot
                        ? "Güncelle"
                        : "Oluştur"}
                  </Button>
                </div>
              </div>
            </form>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Silme Onayı</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Bu ders kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Siliniyor..." : "Sil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
