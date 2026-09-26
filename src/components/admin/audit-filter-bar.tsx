"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, NativeSelect } from "@/components/ui/primitives";
import type { AuditFilters } from "@/lib/services/history";

const ENTITIES = ["Asset", "Staff", "User", "Location", "AssetType", "Status", "Lookup", "Settings", "Import", "Export", "Request"];

export function AuditFilterBar({ filters, total }: { filters: AuditFilters; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(filters.q ?? "");
  const [user, setUser] = React.useState(filters.user ?? "");
  const update = React.useCallback((patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    router.replace(`${pathname}?${p}`, { scroll: false });
  }, [sp, pathname, router]);
  React.useEffect(() => {
    if (q === (filters.q ?? "") && user === (filters.user ?? "")) return;
    const t = setTimeout(() => update({ q: q || null, user: user || null }), 350);
    return () => clearTimeout(t);
  }, [q, user, filters.q, filters.user, update]);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search changes, asset IDs…" className="h-8 w-60" />
      <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="User" className="h-8 w-40" />
      <NativeSelect value={filters.entity ?? ""} onChange={(e) => update({ entity: e.target.value || null })} placeholder="All entities" className="h-8 w-40">
        {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
      </NativeSelect>
      <Input type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || null })} className="h-8 w-36" />
      <span className="text-slate-400">–</span>
      <Input type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || null })} className="h-8 w-36" />
      <span className="ml-auto text-[12.5px] text-muted-foreground">{total} entries</span>
    </div>
  );
}
