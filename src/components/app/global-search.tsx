"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Result = {
  assetId: string; deviceName: string | null; type: string; location: string | null; status: string; statusColor: string;
  identifier: string | null; inventoryNumber: string | null; assetNumber: string | null; assignedTo: string | null;
};

/** Top-bar search across Asset ID, IMEI, serial, inventory / asset numbers, device name, location and assignee. */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<{ results: Result[]; total: number }>({ results: [], total: 0 });
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea|select/i.test((e.target as HTMLElement)?.tagName))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData({ results: [], total: 0 });
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setData(await res.json());
          setActive(0);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (assetId: string) => {
    setOpen(false);
    setQ("");
    router.push(`/assets/${encodeURIComponent(assetId)}`);
  };
  const seeAll = () => {
    setOpen(false);
    router.push(`/assets?q=${encodeURIComponent(q.trim())}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, data.results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (data.results[active]) go(data.results[active].assetId);
      else if (q.trim()) seeAll();
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const term = q.trim();
  return (
    <Popover open={open && term.length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search Asset ID, IMEI, serial, inventory no., person…"
            className="h-9 w-full rounded-lg border border-transparent bg-slate-100 pl-9 pr-14 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-ring/40 focus:bg-card focus:ring-2 focus:ring-ring/20"
            aria-label="Global search"
            data-testid="global-search"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-card px-1.5 text-[10px] font-medium text-slate-400 sm:block">Ctrl K</kbd>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[min(36rem,calc(100vw-1.5rem))] p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (inputRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        {loading && !data.results.length ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching…</div>
        ) : data.results.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No assets match “{term}”.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {data.results.map((r, i) => (
              <button
                key={r.assetId}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.assetId)}
                className={cn("flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left", i === active && "bg-slate-100")}
                data-testid="search-result"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold text-slate-900">{r.assetId}</span>
                    <span className="truncate text-[13px] text-slate-600">{r.deviceName}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {[r.type, r.identifier && `S/N ${r.identifier}`, r.inventoryNumber, r.location, r.assignedTo].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Badge color={r.statusColor} dot>{r.status}</Badge>
              </button>
            ))}
            <button onClick={seeAll} className="mt-1 flex w-full items-center justify-between rounded-md border-t px-2.5 py-2 text-[12.5px] text-primary hover:bg-slate-50">
              See all {data.total} results in the Asset Register <CornerDownLeft className="size-3.5" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
