"use client";

import { motion } from "motion/react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type ScheduleSlot = {
  id: string;
  subject_name: string;
  subject_color: string | null;
  teacher_name: string;
  classroom: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type TimetableProps = {
  schedules: ScheduleSlot[];
  onSlotClick?: (slot: ScheduleSlot) => void;
};

const DAYS = [
  { key: 1, label: "Pzt", full: "Pazartesi" },
  { key: 2, label: "Sal", full: "Salı" },
  { key: 3, label: "Çar", full: "Çarşamba" },
  { key: 4, label: "Per", full: "Perşembe" },
  { key: 5, label: "Cum", full: "Cuma" },
  { key: 6, label: "Cmt", full: "Cumartesi" },
];

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08-21
const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 8;

function timeToMinutes(t: string): number {
  const parts = t.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export function Timetable({ schedules, onSlotClick }: TimetableProps) {
  return (
    <>
      {/* Desktop Timetable Grid */}
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="border-border grid grid-cols-[60px_repeat(6,1fr)] border-b">
            <div /> {/* corner */}
            {DAYS.map((d) => (
              <div
                key={d.key}
                className="text-muted-foreground py-3 text-center text-xs font-medium"
              >
                {d.label}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="grid grid-cols-[60px_repeat(6,1fr)]">
            {/* Time labels */}
            <div className="relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="text-muted-foreground flex items-start justify-end pr-2 text-[11px]"
                  style={{ height: HOUR_HEIGHT }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((d) => {
              const daySlots = schedules.filter((s) => s.day_of_week === d.key);
              return (
                <div
                  key={d.key}
                  className="border-border relative border-l"
                  style={{ height: HOURS.length * HOUR_HEIGHT }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="border-border/50 absolute w-full border-t"
                      style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Lesson blocks */}
                  {daySlots.map((s) => {
                    const startMin = timeToMinutes(s.start_time);
                    const endMin = timeToMinutes(s.end_time);
                    const top =
                      ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                    const color = s.subject_color || "#5B5BD6";

                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute right-1 left-1 overflow-hidden rounded-md border px-2 py-1 ${onSlotClick ? "cursor-pointer" : ""}`}
                        style={{
                          top,
                          height: Math.max(height, 28),
                          backgroundColor: color + "15",
                          borderColor: color + "40",
                        }}
                        onClick={() => onSlotClick?.(s)}
                        whileHover={onSlotClick ? { scale: 1.02 } : undefined}
                      >
                        <p
                          className="truncate text-xs leading-tight font-semibold"
                          style={{ color }}
                        >
                          {s.subject_name}
                        </p>
                        {height >= 40 && (
                          <p className="text-muted-foreground truncate text-[10px] leading-tight">
                            {s.teacher_name}
                          </p>
                        )}
                        {height >= 55 && s.classroom && (
                          <p className="text-muted-foreground truncate text-[10px] leading-tight">
                            {s.classroom}
                          </p>
                        )}
                        {height >= 55 && (
                          <p className="text-muted-foreground text-[10px] leading-tight">
                            {formatTime(s.start_time)} –{" "}
                            {formatTime(s.end_time)}
                          </p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-4 md:hidden">
        {DAYS.map((d) => {
          const daySlots = schedules
            .filter((s) => s.day_of_week === d.key)
            .sort(
              (a, b) =>
                timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
            );
          if (daySlots.length === 0) return null;
          return (
            <div key={d.key}>
              <h3 className="text-foreground mb-2 text-sm font-medium">
                {d.full}
              </h3>
              <div className="space-y-2">
                {daySlots.map((s, i) => {
                  const color = s.subject_color || "#5B5BD6";
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                    >
                      <Card
                        className={
                          onSlotClick
                            ? "hover:border-primary/30 cursor-pointer transition-colors"
                            : ""
                        }
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                        onClick={() => onSlotClick?.(s)}
                      >
                        <CardContent className="flex items-center justify-between p-3">
                          <div>
                            <p className="text-foreground text-sm font-medium">
                              {s.subject_name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {s.teacher_name}
                              {s.classroom ? ` · ${s.classroom}` : ""}
                            </p>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {formatTime(s.start_time)} –{" "}
                            {formatTime(s.end_time)}
                          </span>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {schedules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">
              Henüz ders programı oluşturulmadı
            </p>
          </div>
        )}
      </div>

      {/* Desktop empty state */}
      {schedules.length === 0 && (
        <div className="hidden flex-col items-center justify-center py-12 text-center md:flex">
          <CalendarDays className="text-muted-foreground mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            Henüz ders programı oluşturulmadı
          </p>
        </div>
      )}
    </>
  );
}
