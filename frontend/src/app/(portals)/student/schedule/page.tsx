"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Timetable, type ScheduleSlot } from "@/components/schedule/timetable";

export default function StudentSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ScheduleSlot[]>("/api/v1/student/schedule")
      .then((data) => setSchedule(data ?? []))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Program yüklenemedi");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold">Ders Programım</h1>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Timetable schedules={schedule} />
      </motion.div>
    </div>
  );
}
