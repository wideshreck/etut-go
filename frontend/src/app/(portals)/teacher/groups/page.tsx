"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Layers, Users, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Group = {
  id: string;
  name: string;
  grade_level: string;
  field: string | null;
  academic_year: string;
  classroom: string | null;
  status: string;
  student_count: number;
};

type Student = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TeacherGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    api
      .get<Group[]>("/api/v1/teacher/groups")
      .then((data) => setGroups(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openGroup(group: Group) {
    setSelectedGroup(group);
    setStudentsLoading(true);
    try {
      const data = await api.get<Student[]>(
        `/api/v1/teacher/groups/${group.id}/students`,
      );
      setStudents(data);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }

  function closeDialog() {
    setSelectedGroup(null);
    setStudents([]);
  }

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Sınıflarım</h1>

      {groups.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <Layers className="text-muted-foreground/50 h-12 w-12" />
          <p className="text-muted-foreground mt-4 text-sm">
            Henüz atanmış sınıfınız bulunmuyor
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
            >
              <Card
                className="hover:border-primary/30 cursor-pointer transition-colors"
                onClick={() => openGroup(g)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="text-foreground text-base font-semibold">
                        {g.name}
                      </h3>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {g.grade_level}
                        {g.field ? ` · ${g.field}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{g.academic_year}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-4 flex items-center gap-1.5 text-sm">
                    <Users className="h-4 w-4" />
                    <span>{g.student_count} öğrenci</span>
                    {g.classroom && (
                      <>
                        <span className="mx-1">&middot;</span>
                        <span>{g.classroom}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          {selectedGroup && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>{selectedGroup?.name}</DialogTitle>
              </DialogHeader>
              {/* Group Info */}
              <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{selectedGroup.grade_level}</Badge>
                {selectedGroup.field && (
                  <Badge variant="outline">{selectedGroup.field}</Badge>
                )}
                <Badge variant="outline">{selectedGroup.academic_year}</Badge>
                {selectedGroup.classroom && (
                  <Badge variant="secondary">{selectedGroup.classroom}</Badge>
                )}
              </div>

              {/* Student List */}
              <div>
                <h4 className="text-foreground mb-2 text-sm font-medium">
                  Öğrenciler ({selectedGroup.student_count})
                </h4>

                {studentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                  </div>
                ) : students.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Bu sınıfta öğrenci bulunmuyor
                  </p>
                ) : (
                  <div className="space-y-2">
                    {students.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                              {s.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div>
                              <p className="text-foreground text-sm font-medium">
                                {s.full_name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {s.email}
                              </p>
                            </div>
                          </div>
                          {s.phone && (
                            <span className="text-muted-foreground text-xs">
                              {s.phone}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dialog Footer */}
              <div className="border-border border-t pt-3">
                <Link
                  href="/teacher/attendance"
                  className="text-primary text-sm hover:underline"
                >
                  Yoklama Detayı &rarr;
                </Link>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
