"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import { Timetable, type ScheduleSlot } from "@/components/schedule/timetable";

export default function TeacherSchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ScheduleSlot[]>("/api/v1/teacher/schedule")
      .then((data) => setSchedule(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <h1 className="text-foreground text-2xl font-semibold">Ders Programım</h1>
      <Timetable schedules={schedule} />
    </motion.div>
  );
}
