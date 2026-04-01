"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ClipboardList, Check, AlertCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Assignment = {
  id: string;
  title: string;
  description: string;
  assignment_type: string;
  subject_name: string;
  subject_color?: string | null;
  teacher_name: string;
  due_date: string;
  is_completed: boolean;
  completed_at: string | null;
  teacher_note: string | null;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_LABELS: Record<string, string> = {
  homework: "Ev Ödevi",
  test: "Test",
  project: "Proje",
  reading: "Okuma",
  practice: "Alıştırma",
};

type FilterTab = "all" | "pending" | "done";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ParentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    api
      .get<Assignment[]>("/api/v1/parent/assignments")
      .then((data) => setAssignments(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (tab === "pending") return !a.is_completed;
      if (tab === "done") return a.is_completed;
      return true;
    });
  }, [assignments, tab]);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Ödevler</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="flex-1 sm:flex-initial">
            Tümü
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex-1 sm:flex-initial">
            Yapılmadı
          </TabsTrigger>
          <TabsTrigger value="done" className="flex-1 sm:flex-initial">
            Yapıldı
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="text-muted-foreground/50 mb-3 h-12 w-12" />
              <p className="text-muted-foreground text-sm">
                {tab === "all"
                  ? "Henüz ödev bulunmuyor"
                  : tab === "pending"
                    ? "Bekleyen ödev bulunmuyor"
                    : "Tamamlanmış ödev bulunmuyor"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((a, i) => {
                const isOverdue =
                  !a.is_completed && new Date(a.due_date) < new Date();
                const color = a.subject_color || "#5B5BD6";

                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                  >
                    <Card
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: color,
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <Badge variant="outline">
                                {TYPE_LABELS[a.assignment_type] ??
                                  a.assignment_type}
                              </Badge>
                              <Badge variant="secondary">
                                {a.subject_name}
                              </Badge>
                            </div>
                            <h3 className="text-foreground text-sm font-medium">
                              {a.title}
                            </h3>
                            {a.description && (
                              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                                {a.description}
                              </p>
                            )}
                          </div>
                          <div className="ml-3 shrink-0">
                            {a.is_completed ? (
                              <div className="bg-success/10 flex h-8 w-8 items-center justify-center rounded-full">
                                <Check className="text-success h-4 w-4" />
                              </div>
                            ) : isOverdue ? (
                              <div className="bg-destructive/10 flex h-8 w-8 items-center justify-center rounded-full">
                                <AlertCircle className="text-destructive h-4 w-4" />
                              </div>
                            ) : (
                              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                                <Clock className="text-muted-foreground h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                          <span>{a.teacher_name}</span>
                          <span>
                            Teslim:{" "}
                            {new Date(a.due_date).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                        {a.teacher_note && (
                          <div className="bg-muted text-foreground mt-2 rounded-md p-2 text-xs">
                            <span className="font-medium">Öğretmen notu:</span>{" "}
                            {a.teacher_note}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
