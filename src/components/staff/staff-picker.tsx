"use client";

import * as React from "react";
import { Search, Loader2, X, UserRound } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/primitives";
import { searchStaffAction } from "@/app/actions/staff";
import type { StaffOption } from "@/lib/services/staff";
import { cn } from "@/lib/utils";

/** Searchable staff combobox (name, employee number, designation). */
export function StaffPicker({
  value,
  onChange,
  invalid,
  placeholder = "Search staff name or employee no…",
}: {
  value: StaffOption | null;
  onChange: (s: StaffOption | null) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<StaffOption[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchStaffAction(q);
      if (!cancelled) {
        setOptions(r);
        setActive(0);
        setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  const pick = (o: StaffOption) => {
    onChange(o);
    setOpen(false);
    setQ("");
  };

  if (value) {
    return (
      <div className="flex min-h-9 items-center justify-between gap-2 rounded-md border border-input bg-muted px-3 py-1.5 text-sm" data-testid="picked-staff">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="size-4 shrink-0 text-slate-400" />
          <span className="truncate font-medium">{value.name}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{value.employeeNumber}</span>
        </span>
        <button type="button" onClick={() => { onChange(null); setTimeout(() => inputRef.current?.focus(), 0); }} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear staff">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (options[active]) pick(options[active]); }
            }}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive"
            data-testid="staff-picker"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-1" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (inputRef.current?.contains(e.target as Node)) e.preventDefault(); }}>
        {loading && !options.length ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching…</div>
        ) : options.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">No active staff found. Add them under Staff.</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {options.map((o, i) => (
              <button
                type="button"
                key={o.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn("flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left", i === active && "bg-muted")}
                data-testid="staff-option"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{o.name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{[o.employeeNumber, o.designation, o.shift].filter(Boolean).join(" · ")}</span>
                </span>
                {o.holding > 0 && <span className="shrink-0 rounded bg-muted px-1.5 text-[11px] text-muted-foreground">{o.holding} held</span>}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
