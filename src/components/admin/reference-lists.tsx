"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LookupCategory, StatusCode } from "@prisma/client";
import { Plus, Pencil, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, COLOR_OPTIONS, BADGE_COLORS } from "@/components/ui/badge";
import { Input, Switch } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/forms/field";
import { Tooltip } from "@/components/ui/primitives";
import { addLookupAction, saveStatusAction, toggleLookupAction } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

type StatusRow = { id: string; name: string; code: StatusCode; color: string; active: boolean; count: number };

export function StatusesManager({ rows }: { rows: StatusRow[] }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<Partial<StatusRow> | null>(null);
  const [pending, start] = React.useTransition();
  const save = () =>
    start(async () => {
      const r = await saveStatusAction({ id: edit?.id ?? null, name: edit?.name ?? "", color: edit?.color ?? "gray", active: edit?.active ?? true });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Status saved");
      setEdit(null);
      router.refresh();
    });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Statuses</CardTitle>
          <CardDescription>System statuses drive workflows (they can be renamed and recoloured, not removed). Custom statuses can be added.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEdit({ color: "gray", active: true })}><Plus /> Add status</Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {rows.map((s) => (
          <button key={s.id} onClick={() => setEdit(s)} className={cn("group flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left hover:shadow-sm", !s.active && "opacity-50")}>
            <Badge color={s.color} dot>{s.name}</Badge>
            <span className="text-[11.5px] tabular text-slate-400">{s.count}</span>
            {s.code !== "CUSTOM" && <Tooltip content={`System status (${s.code})`}><Lock className="size-3 text-slate-300" /></Tooltip>}
            <Pencil className="size-3 text-slate-300 group-hover:text-slate-500" />
          </button>
        ))}
      </CardContent>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit status" : "Add status"}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Name" required><Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} /></Field>
            <Field label="Badge colour">
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button key={c} type="button" onClick={() => setEdit((p) => ({ ...p, color: c }))} className={cn("size-7 rounded-full ring-offset-2", BADGE_COLORS[c].dot, edit?.color === c && "ring-2 ring-slate-900")} aria-label={c} />
                ))}
              </div>
            </Field>
            {edit?.name && <div>Preview: <Badge color={edit.color} dot>{edit.name}</Badge></div>}
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={edit?.active ?? true} disabled={!!edit?.code && edit.code !== "CUSTOM"} onCheckedChange={(c) => setEdit((p) => ({ ...p, active: c }))} /> Active</label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} loading={pending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

type LookupRow = { id: string; category: LookupCategory; value: string; active: boolean };
const CATS: { key: LookupCategory; title: string; hint: string }[] = [
  { key: "CONDITION", title: "Conditions", hint: "Physical condition options" },
  { key: "DEPARTMENT", title: "Departments", hint: "Used for assignment" },
  { key: "SHIFT", title: "Shifts / units", hint: "Shift options in forms" },
  { key: "SIM_OPERATOR", title: "SIM operators / plans", hint: "For tablets" },
  { key: "BRAND", title: "Brands", hint: "Suggestions — brands can also be typed freely" },
];

export function LookupsManager({ rows }: { rows: LookupRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const add = (category: LookupCategory) =>
    start(async () => {
      const value = (draft[category] ?? "").trim();
      if (!value) return;
      const r = await addLookupAction({ category, value });
      if (!r.ok) return void toast.error(r.error);
      setDraft((d) => ({ ...d, [category]: "" }));
      router.refresh();
    });
  const toggle = (row: LookupRow) =>
    start(async () => {
      const r = await toggleLookupAction({ id: row.id, active: !row.active });
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {CATS.map((c) => (
        <Card key={c.key}>
          <CardHeader>
            <div>
              <CardTitle>{c.title}</CardTitle>
              <CardDescription>{c.hint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {rows.filter((r) => r.category === c.key).map((r) => (
                <button key={r.id} onClick={() => toggle(r)} disabled={pending} title={r.active ? "Click to deactivate" : "Click to reactivate"} className={cn("rounded-md border px-2 py-1 text-[12.5px]", r.active ? "bg-card" : "bg-slate-50 text-slate-400 line-through")}>
                  {r.value}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(c.key); }}>
              <Input value={draft[c.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))} placeholder="Add value…" className="h-8" />
              <Button size="sm" variant="outline" type="submit" disabled={pending}><Plus /></Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
