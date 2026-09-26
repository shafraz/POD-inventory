"use client";

import * as React from "react";
import { Search, Loader2, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { searchAssetsAction } from "@/app/actions/assets";
import { cn } from "@/lib/utils";

type Option = Awaited<ReturnType<typeof searchAssetsAction>>[number];

/** Searchable asset combobox (Asset ID, device name, IMEI/serial, inventory or asset number). */
export function AssetPicker({
  value,
  label,
  onChange,
  invalid,
  disabled,
}: {
  value: string | null;
  label?: string | null;
  onChange: (id: string | null, option?: Option) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<Option[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchAssetsAction(q);
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

  const pick = (o: Option) => {
    onChange(o.id, o);
    setOpen(false);
    setQ("");
  };

  if (value && label) {
    return (
      <div className={cn("flex h-9 items-center justify-between rounded-md border border-input bg-slate-50 px-3 text-sm", disabled && "opacity-70")}>
        <span className="truncate font-mono font-semibold" data-testid="picked-asset">{label}</span>
        {!disabled && (
          <button type="button" onClick={() => { onChange(null); setTimeout(() => inputRef.current?.focus(), 0); }} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Clear asset">
            <X className="size-4" />
          </button>
        )}
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
            placeholder="Search Asset ID, device, IMEI / serial…"
            aria-invalid={invalid || undefined}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm shadow-xs outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive"
            data-testid="asset-picker"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-1" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (inputRef.current?.contains(e.target as Node)) e.preventDefault(); }}>
        {loading && !options.length ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching…</div>
        ) : options.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">No matching assets.</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {options.map((o, i) => (
              <button
                type="button"
                key={o.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn("flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left", i === active && "bg-slate-100")}
                data-testid="asset-option"
              >
                <span className="font-mono text-[13px] font-semibold">{o.assetId}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-500">{o.deviceName} · {o.location ?? "no location"}</span>
                <Badge color={o.statusColor}>{o.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
