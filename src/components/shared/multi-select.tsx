"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, Checkbox } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type MSOption = { value: string; label: string; dot?: string };

/** Compact multi-select filter chip. */
export function MultiSelect({ label, options, value, onChange, testId }: { label: string; options: MSOption[]; value: string[]; onChange: (v: string[]) => void; testId?: string }) {
  const [q, setQ] = React.useState("");
  const selected = new Set(value);
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const summary = value.length === 0 ? "All" : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? "1" : `${value.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-[12.5px] shadow-xs transition hover:bg-muted",
            value.length > 0 && "border-primary/40 bg-blue-50/60 text-primary",
          )}
          data-testid={testId}
        >
          <span className="text-slate-500">{label}:</span>
          <span className="max-w-[9rem] truncate font-medium">{summary}</span>
          {value.length > 0 ? (
            <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange([]); }} className="rounded p-0.5 hover:bg-blue-100" aria-label={`Clear ${label}`}>
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-slate-400" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1.5">
        {options.length > 8 && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${label.toLowerCase()}…`} className="mb-1 h-8 w-full rounded-md border px-2 text-[12.5px] outline-none focus:border-ring" />
        )}
        <div className="max-h-64 overflow-y-auto">
          {shown.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-muted">
              <Checkbox
                checked={selected.has(o.value)}
                onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((x) => x !== o.value))}
              />
              {o.dot && <span className={cn("size-2 rounded-full", o.dot)} />}
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <button onClick={() => onChange([])} className="mt-1 w-full rounded px-2 py-1.5 text-left text-[12px] font-medium text-primary hover:bg-muted">Clear selection</button>
        )}
      </PopoverContent>
    </Popover>
  );
}
