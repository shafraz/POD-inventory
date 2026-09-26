"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { MultiSelect } from "@/components/shared/multi-select";
import { Pagination, VerificationBadge, EmptyState } from "@/components/shared/misc";
import { useApp } from "@/components/app/app-context";
import { bulkVerifyAction } from "@/app/actions/assets";
import type { VerificationState } from "@/lib/constants";
import { formatDate, todayISO, daysBetween, todayDate } from "@/lib/utils";

type Row = { id: string; assetId: string; deviceName: string | null; type: string; location: string | null; assignedTo: string | null; status: string; statusColor: string; last: string | null; next: string | null; state: VerificationState };

export function VerificationTable({ rows, total, page, pageSize, q: q0, typeFilter, locationFilter, state }: { rows: Row[]; total: number; page: number; pageSize: number; q: string; typeFilter: string[]; locationFilter: string[]; state: VerificationState | null }) {
  const { ref, can, openOperation } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(q0);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState(false);
  const [pending, start] = React.useTransition();
  const today = todayDate();

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
    if (q === q0) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [q, q0, update]);
  React.useEffect(() => setSel(new Set()), [rows]);

  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search asset, device, person…" className="pl-8" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Type" options={ref.types.map((t) => ({ value: t.id, label: t.name }))} value={typeFilter} onChange={(v) => update({ type: v.join(",") || null })} />
          <MultiSelect label="Location" options={[...ref.locations.map((l) => ({ value: l.id, label: l.name })), { value: "none", label: "(No location)" }]} value={locationFilter} onChange={(v) => update({ location: v.join(",") || null })} />
          <span className="text-[12.5px] text-muted-foreground">{total} assets{state ? "" : " (all states)"}</span>
        </div>
      </div>
      {sel.size > 0 && can("verify") && (
        <div className="flex items-center gap-3 border-b bg-violet-50/70 px-3 py-2 text-[13px]">
          <span className="font-medium text-violet-900">{sel.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setConfirm(true)}><ShieldCheck /> Verify selected (today)</Button>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing here" description="No assets match this verification state and filter." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" data-testid="verification-table">
            <thead className="border-b bg-slate-50/80 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {can("verify") && <th className="w-9 px-3"><Checkbox checked={all} onCheckedChange={(c) => setSel(c ? new Set(rows.map((r) => r.id)) : new Set())} /></th>}
                <th className="px-3 py-2">Asset ID</th><th className="px-3">Device</th><th className="px-3">Type</th><th className="px-3">Current location</th><th className="px-3">Assigned to</th><th className="px-3">Status</th><th className="px-3">Last verified</th><th className="px-3">Next verification</th><th className="px-3">Verification</th><th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                  {can("verify") && <td className="px-3"><Checkbox checked={sel.has(r.id)} onCheckedChange={(c) => setSel((s) => { const n = new Set(s); if (c) n.add(r.id); else n.delete(r.id); return n; })} /></td>}
                  <td className="px-3 py-2.5"><Link href={`/assets/${encodeURIComponent(r.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{r.assetId}</Link></td>
                  <td className="whitespace-nowrap px-3">{r.deviceName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3">{r.type}</td>
                  <td className="px-3">{r.location ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-3">{r.assignedTo ?? <span className="text-slate-400">—</span>}</td>
                  <td className="px-3"><Badge color={r.statusColor} dot>{r.status}</Badge></td>
                  <td className="whitespace-nowrap px-3 tabular">{r.last ? formatDate(r.last) : <span className="text-slate-400">Never</span>}</td>
                  <td className="whitespace-nowrap px-3 tabular">
                    {r.next ? formatDate(r.next) : <span className="text-slate-400">—</span>}
                    {r.next && <div className="text-[11px] text-slate-400">{(() => { const d = daysBetween(today, new Date(r.next)); return d < 0 ? `${-d} days overdue` : d === 0 ? "due today" : `in ${d} days`; })()}</div>}
                  </td>
                  <td className="px-3"><VerificationBadge state={r.state} /></td>
                  <td className="px-3 text-right">{can("verify") && <Button size="sm" variant="outline" onClick={() => openOperation({ kind: "VERIFY", assetId: r.id })} data-testid="verify-row"><ShieldCheck /> Verify</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => { const s = new URLSearchParams(sp.toString()); s.set("page", String(p)); return `${pathname}?${s}`; }} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Verify selected assets"
        description={`Record today's verification for ${sel.size} asset${sel.size === 1 ? "" : "s"} with all checks confirmed? Use the per-asset Verify form to record discrepancies.`}
        confirmLabel="Verify"
        loading={pending}
        onConfirm={() => start(async () => {
          const r = await bulkVerifyAction({ ids: [...sel], date: todayISO(), notes: "Bulk verification" });
          setConfirm(false);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`${r.data.done} verified${r.data.errors.length ? `, ${r.data.errors.length} skipped` : ""}`);
          router.refresh();
        })}
      />
    </Card>
  );
}
