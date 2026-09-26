"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { MultiSelect } from "@/components/shared/multi-select";
import { BADGE_COLORS } from "@/components/ui/badge";
import { useApp } from "@/components/app/app-context";
import { ACTION_LABELS, REPAIR_STATUS_LABELS } from "@/lib/constants";

/** Filters for the selected report; stored in the URL so preview and export stay in sync. */
export function ReportFilters({ kind, reportKey }: { kind: string; reportKey: string }) {
  const { ref } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";
  const list = (k: string) => (sp.get(k) ? sp.get(k)!.split(",") : []);
  const [text, setText] = React.useState({ q: get("q"), asset: get("asset"), user: get("user") });

  const update = React.useCallback((patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`${pathname}?${p}`, { scroll: false });
  }, [sp, pathname, router]);

  React.useEffect(() => {
    const changed = (["q", "asset", "user"] as const).filter((k) => (sp.get(k) ?? "") !== text[k]);
    if (!changed.length) return;
    const t = setTimeout(() => update(Object.fromEntries(changed.map((k) => [k, text[k].trim() || null]))), 350);
    return () => clearTimeout(t);
  }, [text, sp, update]);

  const hasAny = [...sp.keys()].some((k) => k !== "report");
  const clear = () => {
    setText({ q: "", asset: "", user: "" });
    router.replace(`${pathname}?report=${reportKey}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/50 px-4 py-3">
      {kind === "assets" && (
        <>
          <Input value={text.q} onChange={(e) => setText((t) => ({ ...t, q: e.target.value }))} placeholder="Search…" className="h-8 w-48" />
          <MultiSelect label="Type" options={ref.types.map((t) => ({ value: t.id, label: t.name }))} value={list("type")} onChange={(v) => update({ type: v.join(",") || null })} />
          {reportKey !== "damaged" && reportKey !== "lost" && (
            <MultiSelect label="Status" options={ref.statuses.map((s) => ({ value: s.id, label: s.name, dot: BADGE_COLORS[s.color]?.dot }))} value={list("status")} onChange={(v) => update({ status: v.join(",") || null })} />
          )}
          <MultiSelect label="Location" options={[...ref.locations.map((l) => ({ value: l.id, label: l.name })), { value: "none", label: "(No location)" }]} value={list("location")} onChange={(v) => update({ location: v.join(",") || null })} />
          <MultiSelect label="Condition" options={ref.conditions.map((c) => ({ value: c, label: c }))} value={list("condition")} onChange={(v) => update({ condition: v.join(",") || null })} />
          <MultiSelect label="Verification" options={[{ value: "VERIFIED", label: "Verified" }, { value: "DUE_SOON", label: "Due Soon" }, { value: "OVERDUE", label: "Overdue" }]} value={list("verification")} onChange={(v) => update({ verification: v.join(",") || null })} />
        </>
      )}
      {kind === "movements" && (
        <>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-500">From <Input type="date" value={get("from")} onChange={(e) => update({ from: e.target.value || null })} className="h-8 w-36" /></label>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-500">To <Input type="date" value={get("to")} onChange={(e) => update({ to: e.target.value || null })} className="h-8 w-36" /></label>
          <Input value={text.asset} onChange={(e) => setText((t) => ({ ...t, asset: e.target.value }))} placeholder="Asset" className="h-8 w-36" />
          <NativeSelect value={get("action")} onChange={(e) => update({ action: e.target.value || null })} placeholder="All actions" className="h-8 w-40">
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
          <NativeSelect value={get("location")} onChange={(e) => update({ location: e.target.value || null })} placeholder="All locations" className="h-8 w-40">
            {ref.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
          </NativeSelect>
          <Input value={text.user} onChange={(e) => setText((t) => ({ ...t, user: e.target.value }))} placeholder="User / person" className="h-8 w-36" />
        </>
      )}
      {kind === "repairs" && (
        <NativeSelect value={get("repairStatus") || "ALL"} onChange={(e) => update({ repairStatus: e.target.value })} className="h-8 w-44">
          <option value="ALL">All repair cases</option>
          {Object.entries(REPAIR_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </NativeSelect>
      )}
      {kind === "audit" && (
        <>
          <Input value={text.q} onChange={(e) => setText((t) => ({ ...t, q: e.target.value }))} placeholder="Search changes…" className="h-8 w-48" />
          <Input value={text.user} onChange={(e) => setText((t) => ({ ...t, user: e.target.value }))} placeholder="User" className="h-8 w-36" />
          <label className="flex items-center gap-1.5 text-[12px] text-slate-500">From <Input type="date" value={get("from")} onChange={(e) => update({ from: e.target.value || null })} className="h-8 w-36" /></label>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-500">To <Input type="date" value={get("to")} onChange={(e) => update({ to: e.target.value || null })} className="h-8 w-36" /></label>
        </>
      )}
      {hasAny && <button onClick={clear} className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-slate-500 hover:text-slate-900"><X className="size-3.5" /> Clear filters</button>}
    </div>
  );
}
