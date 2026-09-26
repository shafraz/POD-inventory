"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, UserPlus, Pencil, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { EmptyState } from "@/components/shared/misc";
import { useApp } from "@/components/app/app-context";
import { StaffFormDialog, type StaffFormValues } from "./staff-form-dialog";
import { cn } from "@/lib/utils";

export type StaffRow = StaffFormValues & { id: string; assets: { assetId: string; type: string }[] };

export function StaffList({ rows, designations, filters }: { rows: StaffRow[]; designations: string[]; filters: { q: string; shift: string; status: string; holding: boolean } }) {
  const { ref, can } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(filters.q);
  const [edit, setEdit] = React.useState<StaffFormValues | null>(null);
  const [open, setOpen] = React.useState(false);
  const canManage = can("staff.manage");

  const update = React.useCallback((patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`${pathname}?${p}`, { scroll: false });
  }, [sp, pathname, router]);

  React.useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, update]);

  const openAdd = () => { setEdit(null); setOpen(true); };
  const openEdit = (r: StaffRow) => { setEdit({ ...r, holding: r.assets.length }); setOpen(true); };
  const holdingTotal = rows.reduce((n, r) => n + r.assets.length, 0);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, employee number, designation…" className="pl-8" data-testid="staff-search" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={filters.shift} onChange={(e) => update({ shift: e.target.value || null })} placeholder="All shifts" className="h-9 w-36">
              {ref.shifts.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
            <NativeSelect value={filters.status} onChange={(e) => update({ status: e.target.value === "active" ? null : e.target.value })} className="h-9 w-32">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </NativeSelect>
            <button onClick={() => update({ holding: filters.holding ? null : "1" })} className={cn("inline-flex h-9 items-center rounded-md border bg-card px-3 text-[13px] shadow-xs hover:bg-muted", filters.holding && "border-primary/40 bg-blue-50 text-primary")}>
              Holding devices
            </button>
            {canManage && <Button onClick={openAdd} data-testid="add-staff"><UserPlus /> Add Staff</Button>}
          </div>
        </div>
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-[12.5px] text-muted-foreground">
          <span data-testid="staff-count">{rows.length} staff</span>
          <span>{holdingTotal} device{holdingTotal === 1 ? "" : "s"} currently with staff</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filters.q || filters.shift || filters.holding ? "No staff match these filters" : "No staff yet"}
            description="Add the people who receive and return tablets and VHF radios."
            action={canManage ? <Button size="sm" onClick={openAdd}><UserPlus /> Add Staff</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]" data-testid="staff-table">
              <thead className="border-b bg-slate-50/80 text-left text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2">Employee No.</th><th className="px-3">Name</th><th className="px-3">Designation</th><th className="px-3">Shift</th><th className="px-3">Department</th><th className="px-3">Devices held</th><th className="px-3">Status</th><th className="w-10" /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("cursor-pointer border-b last:border-0 hover:bg-slate-50", !r.active && "opacity-60")} onClick={() => router.push(`/staff/${r.id}`)} data-testid="staff-row">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12.5px] font-semibold">{r.employeeNumber}</td>
                    <td className="whitespace-nowrap px-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-3">{r.designation || <span className="text-slate-300">—</span>}</td>
                    <td className="whitespace-nowrap px-3">{r.shift || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3">{r.department || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        {r.assets.length === 0 ? <span className="text-slate-300">—</span> : r.assets.slice(0, 4).map((a) => (
                          <Link key={a.assetId} href={`/assets/${encodeURIComponent(a.assetId)}`} className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[11.5px] text-blue-700 hover:underline">{a.assetId}</Link>
                        ))}
                        {r.assets.length > 4 && <span className="text-[11.5px] text-muted-foreground">+{r.assets.length - 4}</span>}
                      </div>
                    </td>
                    <td className="px-3">{r.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}</td>
                    <td className="px-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {canManage && <Button size="icon-sm" variant="ghost" onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`}><Pencil /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <StaffFormDialog open={open} onOpenChange={setOpen} initial={edit} designations={designations} />
    </>
  );
}
