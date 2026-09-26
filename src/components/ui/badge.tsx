import * as React from "react";
import { cn } from "@/lib/utils";

/** Colour tokens used by statuses (stored in DB), actions, severities, verification states. */
export const BADGE_COLORS: Record<string, { badge: string; dot: string; hex: string }> = {
  green: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", dot: "bg-emerald-500", hex: "#10b981" },
  blue: { badge: "bg-blue-50 text-blue-700 ring-blue-600/20", dot: "bg-blue-500", hex: "#3b82f6" },
  orange: { badge: "bg-orange-50 text-orange-700 ring-orange-600/20", dot: "bg-orange-500", hex: "#f97316" },
  red: { badge: "bg-red-50 text-red-700 ring-red-600/20", dot: "bg-red-500", hex: "#ef4444" },
  purple: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500", hex: "#8b5cf6" },
  yellow: { badge: "bg-amber-50 text-amber-800 ring-amber-600/25", dot: "bg-amber-400", hex: "#f59e0b" },
  teal: { badge: "bg-teal-50 text-teal-700 ring-teal-600/20", dot: "bg-teal-500", hex: "#14b8a6" },
  gray: { badge: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400", hex: "#94a3b8" },
  dark: { badge: "bg-[#1e293b] text-white ring-black/30 dark:bg-[#e2e8f0] dark:text-[#0f172a]", dot: "bg-[#1e293b] dark:bg-[#e2e8f0]", hex: "var(--color-slate-700)" },
};

export const COLOR_OPTIONS = Object.keys(BADGE_COLORS);

export function Badge({
  color = "gray",
  dot = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { color?: string; dot?: boolean }) {
  const c = BADGE_COLORS[color] ?? BADGE_COLORS.gray;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset", c.badge, className)}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", c.dot)} />}
      {children}
    </span>
  );
}
