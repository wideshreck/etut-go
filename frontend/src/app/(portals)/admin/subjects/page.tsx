"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BookOpen, Pencil, Plus, Users, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
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
  DialogTrigger,
} from "@/components/ui/dialog";

type Subject = {
  id: string;
  name: string;
  color_code: string | null;
  notes: string | null;
  teacher_count: number;
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [colorCode, setColorCode] = useState("#5B5BD6");
  const [notes, setNotes] = useState("");
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function fetchSubjects() {
    api
      .get<Subject[]>("/api/v1/admin/subjects")
      .then((data) => setSubjects(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchSubjects();
  }, []);

  function resetForm() {
    setName("");
    setColorCode("#5B5BD6");
    setNotes("");
    setEditingSubject(null);
  }

  function openEdit(subject: Subject) {
    setEditingSubject(subject);
    setName(subject.name);
    setColorCode(subject.color_code || "#5B5BD6");
    setNotes(subject.notes || "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name, color_code: colorCode, notes: notes || null };
      if (editingSubject) {
        await api.put(`/api/v1/admin/subjects/${editingSubject.id}`, payload);
        toast.success("Branş başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/subjects", payload);
        toast.success("Branş başarıyla oluşturuldu");
      }
      resetForm();
      setShowForm(false);
      fetchSubjects();
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
      await api.delete(`/api/v1/admin/subjects/${deleteId}`);
      toast.success("Branş başarıyla silindi");
      setDeleteId(null);
      fetchSubjects();
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
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold">Branşlar</h1>
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setShowForm(open);
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Branş Ekle
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSubject ? "Branş Düzenle" : "Yeni Branş"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Branş Adı</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: Matematik"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Renk Kodu</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                    className="border-input bg-background h-9 w-9 cursor-pointer rounded-md border p-0.5"
                  />
                  <Input
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                    className="w-28 font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Not</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Branş hakkında notlar..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
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
                    : editingSubject
                      ? "Güncelle"
                      : "Oluştur"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {subjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Henüz branş eklenmedi
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <Card
                className="hover:border-primary/30 transition-colors"
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: s.color_code || "var(--color-border)",
                }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: (s.color_code || "#5B5BD6") + "15",
                      }}
                    >
                      <BookOpen
                        className="h-4 w-4"
                        style={{
                          color:
                            s.color_code || "var(--color-accent-foreground)",
                        }}
                      />
                    </div>
                    <div>
                      <span className="text-foreground text-sm font-medium">
                        {s.name}
                      </span>
                      {s.notes && (
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs">
                        {s.teacher_count} öğretmen
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

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
            Bu branş kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
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
