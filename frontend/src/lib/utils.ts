import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskTC(tc: string | null | undefined): string {
  if (!tc) return "-";
  if (tc.length < 5) return tc;
  return tc.slice(0, 3) + "****" + tc.slice(-2);
}
