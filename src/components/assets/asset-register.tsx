"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Search, ShieldCheck, Tags, X, Flag, ChevronRight, Archive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/primitives";
import { Badge, BADGE_COLORS } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, ConfirmDialog } from "@/components/ui/overlays";
import { MultiSelect } from "@/components/shared/multi-select";
import { EmptyState, Pagination, VerificationBadge } from "@/components/shared/misc";
import { useApp } from "@/components/app/app-context";
import { bulkStatusAction, bulkVerifyAction } from "@/app/actions/assets";
import type { AssetFilters } from "@/lib/asset-filters";
import type { VerificationState } from "@/lib/constants";
import { cn, formatDate, todayISO } from "@/lib/utils";

export type RegisterRow = {
  id: string; assetId: string; type: string; deviceName: string | null; brand: string | null; model: string | null; serial: string | null;
  inventoryNumber: string | null; assetNumber: string | null; alternateReference: string | null; sim: string | null; location: string | null;
  assignedTo: string | null; status: string; statusColor: string; statusCode: string; lastVerificationDate: string | null; nextVerificationDate: string | null;
  verification: VerificationState; lastOsUpdate: string | null; condition: string | null; remarks: string | null; needsReview: boolean;
};

type ColKey = keyof RegisterRow | "verificationState";
const COLUMNS: { key: ColKey; label: string; sort?: string; default: boolean; className?: string }[] = [
  { key: "type", label: "Type", sort: "type", default: true },
  { key: "deviceName", label: "Device", sort: "deviceName", default: true },
  { key: "brand", label: "Brand", default: false },
  { key: "model", label: "Model", default: false },
  { key: "serial", label: "Serial / IMEI", default: true, className: "font-mono text-[12px]" },
  { key: "inventoryNumber", label: "Inventory No.", sort: "inventoryNumber", default: true },
  { key: "assetNumber", label: "Asset No.", default: false, className: "font-mono text-[12px]" },
  { key: "alternateReference", label: "Alt Ref No.", default: false },
  { key: "sim", label: "SIM / Operator", default: false },
  { key: "location", label: "Location", sort: "location", default: true },
  { key: "assignedTo", label: "Assigned To / Shift", sort: "assignedTo", default: true },
  { key: "status", label: "Status", sort: "status", default: true },
  { key: "lastVerificationDate", label: "Last Verified", sort: "lastVerificationDate", default: false },
  { key: "nextVerificationDate", label: "Next Verification", sort: "nextVerificationDate", default: true },
  { key: "lastOsUpdate", label: "Last OS Update", sort: "lastOsUpdate", default: false },
  { key: "condition", label: "Condition", sort: "condition", default: false },
  { key: "remarks", label: "Remarks", default: false, className: "max-w-[16rem] truncate text-slate-500" },
];
const STORAGE_KEY = "asset-register-columns-v1";

export function AssetRegister({ rows, total, filters }: { rows: RegisterRow[]; total: number; filters: AssetFilters }) {
  const { ref, can } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(filters.q ?? "");
  const [visible, setVisible] = React.useState<Set<ColKey>>(() => new Set(COLUMNS.filter((c) => c.default).map((c) => c.key)));
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulk, setBulk] = React.useState<null | "verify" | "status">(null);
  const [bulkStatus, setBulkStatus] = React.useState("");
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setVisible(new Set(JSON.parse(saved)));
    } catch {}
  }, []);
  React.useEffect(() => setSelected(new Set()), [rows]);
  React.useEffect(() => setQ(filters.q ?? ""), [filters.q]);

  const toggleCol = (k: ColKey) => {
    setVisible((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...n]));
      } catch {}
      return n;
    });
  };

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") p.delete(k);
        else p.set(k, v);
      }
      if (!("page" in patch)) p.delete("page");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [sp, pathname, router],
  );

  // Debounced search
  React.useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, update]);

  const hrefFor = (page: number) => {
    const p = new URLSearchParams(sp.toString());
    p.set("page", String(page));
    return `${pathname}?${p.toString()}`;
  };
  const sortHref = (key: string) => {
    const p = new URLSearchParams(sp.toString());
    const dir = filters.sort === key && filters.dir !== "desc" ? "desc" : "asc";
    p.set("sort", key);
    if (dir === "desc") p.set("dir", "desc");
    else p.delete("dir");
    p.delete("page");
    return `${pathname}?${p.toString()}`;
  };

  const activeFilters = !!(filters.q || filters.type?.length || filters.status?.length || filters.statusCode?.length || filters.location?.length || filters.condition?.length || filters.verification?.length || filters.review || filters.archived);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = rows.some((r) => selected.has(r.id));

  const runBulk = () =>
    start(async () => {
      const ids = [...selected];
      const r = bulk === "verify" ? await bulkVerifyAction({ ids, date: todayISO(), notes: "Bulk verification" }) : await bulkStatusAction({ ids, statusId: bulkStatus, reason: "Bulk status update" });
      setBulk(null);
      if (!r.ok) return void toast.error(r.error);
      if (r.data.errors.length) toast.warning(`${r.data.done} updated, ${r.data.errors.length} skipped: ${r.data.errors[0]}`);
      else toast.success(`${r.data.done} asset${r.data.done === 1 ? "" : "s"} updated`);
      router.refresh();
    });

  const cell = (r: RegisterRow, k: ColKey) => {
    switch (k) {
      case "status":
        return <Badge color={r.statusColor} dot>{r.status}</Badge>;
      case "nextVerificationDate":
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="tabular">{r.nextVerificationDate ? formatDate(r.nextVerificationDate) : <span className="text-slate-400">Never verified</span>}</span>
            {r.statusCode !== "DISPOSED" && r.verification !== "VERIFIED" && <VerificationBadge state={r.verification} />}
          </div>
        );
      case "lastVerificationDate":
      case "lastOsUpdate":
        return <span className="whitespace-nowrap tabular">{r[k] ? formatDate(r[k] as string) : "—"}</span>;
      default: {
        const v = r[k as keyof RegisterRow];
        return v === null || v === "" || v === undefined ? <span className="text-slate-300">—</span> : String(v);
      }
    }
  };

  const cols = COLUMNS.filter((c) => visible.has(c.key));
  const SortIcon = ({ k }: { k?: string }) => (!k ? null : filters.sort === k ? (filters.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />) : <ArrowUpDown className="size-3 opacity-30" />);

  return (
    <Card className="overflow-hidden">
      {/* Filter bar */}
      <div className="space-y-2.5 border-b p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Asset ID, device, serial / IMEI, inventory / asset no., location, person, remarks…" className="pl-8" data-testid="asset-search" />
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Columns3 /> Columns</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUMNS.map((c) => (
                  <DropdownMenuCheckboxItem key={c.key} checked={visible.has(c.key)} onCheckedChange={() => toggleCol(c.key)} onSelect={(e) => e.preventDefault()}>
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Type" testId="filter-type" options={ref.types.map((t) => ({ value: t.id, label: t.name }))} value={filters.type ?? []} onChange={(v) => update({ type: v.join(",") || null })} />
          <MultiSelect label="Status" testId="filter-status" options={ref.statuses.map((s) => ({ value: s.id, label: s.name, dot: BADGE_COLORS[s.color]?.dot }))} value={filters.status ?? []} onChange={(v) => update({ status: v.join(",") || null, statusCode: null })} />
          <MultiSelect label="Location" testId="filter-location" options={[...ref.locations.map((l) => ({ value: l.id, label: l.name })), { value: "none", label: "(No location)" }]} value={filters.location ?? []} onChange={(v) => update({ location: v.join(",") || null })} />
          <MultiSelect label="Condition" options={[...ref.conditions.map((c) => ({ value: c, label: c })), { value: "none", label: "(Not recorded)" }]} value={filters.condition ?? []} onChange={(v) => update({ condition: v.join(",") || null })} />
          <MultiSelect
            label="Verification"
            options={[{ value: "VERIFIED", label: "Verified", dot: "bg-emerald-500" }, { value: "DUE_SOON", label: "Due Soon", dot: "bg-amber-500" }, { value: "OVERDUE", label: "Overdue", dot: "bg-red-500" }]}
            value={filters.verification ?? []}
            onChange={(v) => update({ verification: v.join(",") || null })}
          />
          <button onClick={() => update({ review: filters.review ? null : "1" })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-[12.5px] shadow-xs hover:bg-muted", filters.review && "border-amber-300 bg-amber-50 text-amber-800")}>
            <Flag className="size-3.5" /> Needs review
          </button>
          {can("asset.delete") && (
            <button onClick={() => update({ archived: filters.archived ? null : "1" })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-[12.5px] shadow-xs hover:bg-muted", filters.archived && "border-slate-400 bg-slate-100")}>
              <Archive className="size-3.5" /> Archived
            </button>
          )}
          {filters.statusCode?.length ? <Badge color="blue">Status: {filters.statusCode.join(", ")}</Badge> : null}
          {activeFilters && (
            <button onClick={() => router.replace(pathname)} className="inline-flex h-8 items-center gap-1 px-2 text-[12.5px] font-medium text-slate-500 hover:text-slate-900">
              <X className="size-3.5" /> Clear all
            </button>
          )}
          <span className="ml-auto text-[12.5px] text-muted-foreground" data-testid="result-count">{total} asset{total === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* Bulk bar */}
      {someChecked && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-blue-50/70 px-3 py-2 text-[13px]">
          <span className="font-medium text-blue-900">{selected.size} selected</span>
          {can("verify") && <Button size="sm" variant="outline" onClick={() => setBulk("verify")}><ShieldCheck /> Verify selected</Button>}
          {can("asset.edit") && (
            <div className="flex items-center gap-1.5">
              <NativeSelect value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} placeholder="Set status…" className="h-8 w-40 text-[12.5px]">
                {ref.statuses.filter((s) => s.code !== "UNDER_REPAIR").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
              <Button size="sm" variant="outline" disabled={!bulkStatus} onClick={() => setBulk("status")}><Tags /> Apply</Button>
            </div>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[12.5px] font-medium text-blue-800 hover:underline">Clear selection</button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No assets match these filters" description="Try removing a filter or searching for a different identifier." action={activeFilters ? <Button variant="outline" size="sm" onClick={() => router.replace(pathname)}>Clear filters</Button> : undefined} />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[13px]" data-testid="asset-table">
              <thead className="border-b bg-slate-50/80">
                <tr>
                  <th className="w-9 px-3">
                    <Checkbox checked={allChecked ? true : someChecked ? "indeterminate" : false} onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Select all" />
                  </th>
                  <th className="h-9 whitespace-nowrap px-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <Link href={sortHref("assetId")} className="inline-flex items-center gap-1 hover:text-slate-900">Asset ID <SortIcon k="assetId" /></Link>
                  </th>
                  {cols.map((c) => (
                    <th key={c.key} className="h-9 whitespace-nowrap px-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                      {c.sort ? <Link href={sortHref(c.sort)} className="inline-flex items-center gap-1 hover:text-slate-900">{c.label} <SortIcon k={c.sort} /></Link> : c.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    data-state={selected.has(r.id) ? "selected" : undefined}
                    className="group cursor-pointer border-b last:border-0 hover:bg-slate-50 data-[state=selected]:bg-blue-50/50"
                    onClick={() => router.push(`/assets/${encodeURIComponent(r.assetId)}`)}
                    data-testid="asset-row"
                  >
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(r.id); else n.delete(r.id); return n; })} aria-label={`Select ${r.assetId}`} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-mono text-[12.5px] font-semibold text-slate-900 group-hover:text-primary">{r.assetId}</span>
                      {r.needsReview && <Flag className="ml-1.5 inline size-3 text-amber-500" aria-label="Needs review" />}
                    </td>
                    {cols.map((c) => (
                      <td key={c.key} className={cn("px-3 py-2.5", c.className, !c.className?.includes("max-w") && "whitespace-nowrap")}>{cell(r, c.key)}</td>
                    ))}
                    <td className="px-2 text-slate-300 group-hover:text-slate-500"><ChevronRight className="size-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-y md:hidden">
            {rows.map((r) => (
              <Link key={r.id} href={`/assets/${encodeURIComponent(r.assetId)}`} className="block px-4 py-3 active:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold">{r.assetId}</span>
                  <Badge color={r.statusColor} dot>{r.status}</Badge>
                </div>
                <div className="mt-0.5 text-[13px] text-slate-700">{r.deviceName ?? "—"} <span className="text-slate-400">· {r.type}</span></div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-slate-500">
                  <span>{r.location ?? "No location"}</span>
                  {r.assignedTo && <span>{r.assignedTo}</span>}
                  {r.serial && <span className="font-mono">{r.serial}</span>}
                </div>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Pagination page={filters.page ?? 1} pageSize={filters.pageSize ?? 25} total={total} hrefFor={hrefFor} />
            </div>
            <div className="hidden pr-4 sm:block">
              <NativeSelect value={String(filters.pageSize ?? 25)} onChange={(e) => update({ pageSize: e.target.value, page: null })} className="h-8 w-28 text-[12.5px]">
                {[25, 50, 100, 250].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </NativeSelect>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={bulk !== null}
        onOpenChange={(o) => !o && setBulk(null)}
        title={bulk === "verify" ? "Verify selected assets" : "Update status"}
        description={
          bulk === "verify"
            ? `Record a verification (all checks confirmed, today) for ${selected.size} asset${selected.size === 1 ? "" : "s"}? Next verification dates will be recalculated.`
            : `Change the status of ${selected.size} asset${selected.size === 1 ? "" : "s"} to “${ref.statuses.find((s) => s.id === bulkStatus)?.name}”? Each change is recorded in the movement log and audit trail.`
        }
        confirmLabel={bulk === "verify" ? "Verify" : "Update status"}
        loading={pending}
        onConfirm={runBulk}
      />
    </Card>
  );
}
