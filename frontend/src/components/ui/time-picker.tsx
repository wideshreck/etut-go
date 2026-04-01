"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const MINUTES = ["00", "15", "30", "45"];

type TimePickerProps = {
  value: string; // "HH:mm" or ""
  onChange: (value: string) => void;
  placeholder?: string;
};

export function TimePicker({
  value,
  onChange,
  placeholder = "Saat",
}: TimePickerProps) {
  const [hour, minute] = value ? value.split(":") : ["", ""];

  function update(h: string, m: string) {
    if (h && m) {
      onChange(`${h}:${m}`);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={hour} onValueChange={(h) => update(h, minute || "00")}>
        <SelectTrigger className="w-[70px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={minute} onValueChange={(m) => update(hour || "09", m)}>
        <SelectTrigger className="w-[70px]">
          <SelectValue placeholder="Dk" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
