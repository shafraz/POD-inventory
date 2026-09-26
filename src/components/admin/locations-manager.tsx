"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Switch, Textarea } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/forms/field";
import { saveLocationAction } from "@/app/actions/admin";

type Row = { id: string; name: string; description: string | null; aliases: string[]; active: boolean; count: number };

export function LocationsManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<Partial<Row> | null>(null);
  const [aliases, setAliases] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  const open = (r: Partial<Row>) => {
    setEdit(r);
    setAliases((r.aliases ?? []).join(", "));
    setErrors({});
  };
  const save = () =>
    start(async () => {
      const res = await saveLocationAction({
        id: edit?.id ?? null,
        name: edit?.name ?? "",
        description: edit?.description ?? null,
        aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean),
        active: edit?.active ?? true,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success("Location saved");
      setEdit(null);
      router.refresh();
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-end border-b p-3">
        <Button size="sm" onClick={() => open({ active: true })} data-testid="add-location"><Plus /> Add location</Button>
      </div>
      <Table>
        <THead><TR><TH>Name</TH><TH>Description</TH><TH>Aliases (import)</TH><TH className="text-right">Assets</TH><TH>Status</TH><TH /></TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium">{r.name}</TD>
              <TD className="text-slate-600">{r.description ?? "—"}</TD>
              <TD className="text-slate-600">{r.aliases.length ? r.aliases.join(", ") : "—"}</TD>
              <TD className="text-right tabular"><Link href={`/assets?location=${r.id}`} className="text-primary hover:underline">{r.count}</Link></TD>
              <TD>{r.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}</TD>
              <TD className="text-right"><Button size="icon-sm" variant="ghost" onClick={() => open(r)} aria-label={`Edit ${r.name}`}><Pencil /></Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{edit?.id ? "Edit location" : "Add location"}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Name" required error={errors.name}><Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} data-testid="location-name" /></Field>
            <Field label="Description"><Textarea value={edit?.description ?? ""} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} rows={2} /></Field>
            <Field label="Aliases" hint="Comma-separated alternative spellings, e.g. C-Yard, C Yard"><Input value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={edit?.active ?? true} onCheckedChange={(c) => setEdit((p) => ({ ...p, active: c }))} /> Active (available in forms)</label>
            {edit?.id && !edit.active && (edit.count ?? 0) > 0 && <p className="text-xs text-amber-700">{edit.count} assets are still at this location. They keep it; it just won’t be offered for new movements.</p>}
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
