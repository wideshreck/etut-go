"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Megaphone, Pin, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export default function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get<Announcement[]>("/api/v1/student/announcements")
      .then((data) => setAnnouncements(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  const filtered = announcements.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Duyurular</h1>

      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
        <Input
          placeholder="Duyuru ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Megaphone className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground mt-4 text-sm">
            Henüz duyuru yayınlanmadı
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            >
              <Card
                className={cn(
                  "transition-colors",
                  a.is_pinned && "border-l-primary border-l-4",
                )}
              >
                <CardContent className="p-4">
                  <div className="min-w-0">
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
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
