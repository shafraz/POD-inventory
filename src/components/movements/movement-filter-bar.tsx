"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { useApp } from "@/components/app/app-context";
import { ACTION_LABELS } from "@/lib/constants";
import type { MovementFilters } from "@/lib/services/history";

export function MovementFilterBar({ filters, total }: { filters: MovementFilters; total: number }) {
  const { ref } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [asset, setAsset] = React.useState(filters.asset ?? "");
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
    if ((filters.asset ?? "") === asset && (filters.user ?? "") === user) return;
    const t = setTimeout(() => update({ asset: asset.trim() || null, user: user.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [asset, user, filters.asset, filters.user, update]);

  const any = filters.from || filters.to || filters.asset || filters.action || filters.location || filters.user;
  return (
    <div className="grid grid-cols-2 gap-2 border-b p-3 md:grid-cols-4 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
      <label className="text-[11.5px] text-slate-500">From<Input type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || null })} className="mt-1 h-8" /></label>
      <label className="text-[11.5px] text-slate-500">To<Input type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || null })} className="mt-1 h-8" /></label>
      <label className="text-[11.5px] text-slate-500">Asset<Input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="ID, name, serial" className="mt-1 h-8" /></label>
      <label className="text-[11.5px] text-slate-500">Action
        <NativeSelect value={filters.action ?? ""} onChange={(e) => update({ action: e.target.value || null })} placeholder="All actions" className="mt-1 h-8">
          {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
      </label>
      <label className="text-[11.5px] text-slate-500">Location
        <NativeSelect value={filters.location ?? ""} onChange={(e) => update({ location: e.target.value || null })} placeholder="All locations" className="mt-1 h-8">
          {ref.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
        </NativeSelect>
      </label>
      <label className="text-[11.5px] text-slate-500">User / person<Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Done by or assignee" className="mt-1 h-8" /></label>
      <div className="col-span-2 flex items-end justify-between gap-3 md:col-span-4 xl:col-span-1 xl:flex-col xl:items-end xl:justify-end">
        <span className="text-[12px] text-muted-foreground">{total} records</span>
        {any && <button onClick={() => { setAsset(""); setUser(""); router.replace(pathname); }} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-900"><X className="size-3.5" /> Clear</button>}
      </div>
    </div>
  );
}
