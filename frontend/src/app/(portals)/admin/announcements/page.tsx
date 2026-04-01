"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

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

const TARGET_LABELS: Record<string, string> = {
  all: "Herkes",
  teacher: "Öğretmenler",
  student: "Öğrenciler",
  parent: "Veliler",
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

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* form state */
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [priority, setPriority] = useState("normal");
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");

  /* edit state */
  const [editingId, setEditingId] = useState<string | null>(null);

  /* delete state */
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAnnouncements = useCallback(() => {
    api
      .get<Announcement[]>("/api/v1/admin/announcements")
      .then((data) => setAnnouncements(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  function resetForm() {
    setTitle("");
    setContent("");
    setTargetRole("all");
    setPriority("normal");
    setIsPinned(false);
    setExpiresAt("");
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(a: Announcement) {
    setTitle(a.title);
    setContent(a.content);
    setTargetRole(a.target_role);
    setPriority(a.priority);
    setIsPinned(a.is_pinned);
    setExpiresAt(a.expires_at ? a.expires_at.slice(0, 10) : "");
    setEditingId(a.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        title,
        content,
        target_role: targetRole,
        priority,
        is_pinned: isPinned,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      if (editingId) {
        await api.put(`/api/v1/admin/announcements/${editingId}`, payload);
        toast.success("Duyuru başarıyla güncellendi");
      } else {
        await api.post("/api/v1/admin/announcements", payload);
        toast.success("Duyuru başarıyla yayınlandı");
      }
      resetForm();
      setShowForm(false);
      fetchAnnouncements();
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
      await api.delete(`/api/v1/admin/announcements/${deleteId}`);
      toast.success("Duyuru başarıyla silindi");
      setDeleteId(null);
      fetchAnnouncements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setDeleting(false);
    }
  }

  function isExpired(a: Announcement) {
    return a.expires_at && new Date(a.expires_at) < new Date();
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-2xl font-semibold">Duyurular</h1>
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (!open) resetForm();
            setShowForm(open);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Duyuru Yayınla
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Duyuruyu Düzenle" : "Yeni Duyuru"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Başlık</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>İçerik</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={5}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hedef Kitle</Label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Herkes</SelectItem>
                      <SelectItem value="teacher">Öğretmenler</SelectItem>
                      <SelectItem value="student">Öğrenciler</SelectItem>
                      <SelectItem value="parent">Veliler</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Öncelik</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Önemli</SelectItem>
                      <SelectItem value="urgent">Acil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Son Geçerlilik Tarihi</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isPinned}
                  onClick={() => setIsPinned(!isPinned)}
                  className={cn(
                    "border-input flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                    isPinned && "bg-primary border-primary",
                  )}
                >
                  {isPinned && (
                    <svg
                      className="text-primary-foreground h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <Label
                  className="cursor-pointer"
                  onClick={() => setIsPinned(!isPinned)}
                >
                  Sabitlensin mi?
                </Label>
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
                    : editingId
                      ? "Güncelle"
                      : "Yayınla"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Megaphone className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground mt-4 text-sm">
            Henüz duyuru yayınlanmadı
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Card
                className={cn(
                  "hover:border-primary/30 transition-colors",
                  a.is_pinned && "border-l-primary border-l-4",
                  isExpired(a) && "opacity-60",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        {a.is_pinned && (
                          <Pin className="text-primary h-3.5 w-3.5 shrink-0" />
                        )}
                        <Badge variant={PRIORITY_VARIANTS[a.priority]}>
                          {PRIORITY_LABELS[a.priority]}
                        </Badge>
                        <Badge variant="outline">
                          {TARGET_LABELS[a.target_role]}
                        </Badge>
                        {isExpired(a) && (
                          <Badge variant="outline" className="text-destructive">
                            Süresi doldu
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-foreground text-sm font-semibold">
                        {a.title}
                      </h3>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {a.content}
                      </p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        {a.author_name} &middot;{" "}
                        {new Date(a.created_at).toLocaleDateString("tr-TR")}
                        {a.expires_at &&
                          ` · Son: ${new Date(a.expires_at).toLocaleDateString("tr-TR")}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteId(a.id)}
                      >
                        <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                      </Button>
                    </div>
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
            Bu duyuru kalıcı olarak silinecektir. Devam etmek istiyor musunuz?
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
