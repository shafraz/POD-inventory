"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Switch, Textarea } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/overlays";
import { Field, FormSection } from "@/components/forms/field";
import { saveAssetTypeAction } from "@/app/actions/admin";
import { CORE_LABELS, type AssetTypeConfig, type ExtraField, type CoreLabelKey } from "@/lib/asset-type-config";

type Row = { id: string; name: string; prefix: string; description: string | null; active: boolean; config: AssetTypeConfig; count: number };

export function AssetTypesManager({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<Row | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  const blank: Row = { id: "", name: "", prefix: "", description: null, active: true, config: { identifier: "serial", extraFields: [], labels: {} }, count: 0 };
  const setCfg = (patch: Partial<AssetTypeConfig>) => setEdit((e) => (e ? { ...e, config: { ...e.config, ...patch } } : e));
  const fields = edit?.config.extraFields ?? [];
  const setField = (i: number, patch: Partial<ExtraField>) => setCfg({ extraFields: fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

  const save = () =>
    start(async () => {
      if (!edit) return;
      const labels = Object.fromEntries(Object.entries(edit.config.labels ?? {}).filter(([, v]) => v));
      const res = await saveAssetTypeAction({
        id: edit.id || null, name: edit.name, prefix: edit.prefix, description: edit.description, active: edit.active,
        config: { ...edit.config, labels, extraFields: fields.filter((f) => f.key && f.label).map((f) => ({ ...f, options: f.type === "select" ? f.options ?? [] : undefined })) },
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success("Asset type saved");
      setEdit(null);
      router.refresh();
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-end border-b p-3"><Button size="sm" onClick={() => { setErrors({}); setEdit(blank); }}><Plus /> Add asset type</Button></div>
      <Table>
        <THead><TR><TH>Name</TH><TH>Prefix</TH><TH>Example ID</TH><TH>Description</TH><TH>Identifier</TH><TH>Extra fields</TH><TH className="text-right">Assets</TH><TH>Status</TH><TH /></TR></THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium">{r.name}</TD>
              <TD className="font-mono">{r.prefix}</TD>
              <TD className="font-mono text-slate-500">{r.prefix}-001</TD>
              <TD className="text-slate-600">{r.description ?? "—"}</TD>
              <TD>{r.config.identifier === "imei" ? "IMEI" : "Serial no."}</TD>
              <TD className="text-slate-600">{r.config.extraFields?.map((f) => f.label).join(", ") || "—"}</TD>
              <TD className="text-right tabular"><Link href={`/assets?type=${r.id}`} className="text-primary hover:underline">{r.count}</Link></TD>
              <TD>{r.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}</TD>
              <TD className="text-right"><Button size="icon-sm" variant="ghost" onClick={() => { setErrors({}); setEdit(r); }} aria-label={`Edit ${r.name}`}><Pencil /></Button></TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? `Edit ${edit.name}` : "Add asset type"}</DialogTitle>
            <DialogDescription>Asset IDs are generated as PREFIX-001, PREFIX-002 … The prefix is locked once assets exist.</DialogDescription>
          </DialogHeader>
          {edit && (
            <DialogBody className="space-y-6">
              <FormSection title="General">
                <Field label="Name" required error={errors.name}><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <Field label="Prefix" required error={errors.prefix}><Input value={edit.prefix} onChange={(e) => setEdit({ ...edit, prefix: e.target.value.toUpperCase() })} disabled={!!edit.id && edit.count > 0} className="font-mono" /></Field>
                <Field label="Description" className="sm:col-span-2"><Textarea rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
                <Field label="Primary identifier">
                  <NativeSelect value={edit.config.identifier ?? "serial"} onChange={(e) => setCfg({ identifier: e.target.value as "imei" | "serial" })}>
                    <option value="serial">Serial number</option><option value="imei">IMEI</option>
                  </NativeSelect>
                </Field>
                <div className="flex flex-col justify-end gap-2 pb-1 text-[13px]">
                  <label className="flex items-center gap-2"><Switch checked={!!edit.config.hasSim} onCheckedChange={(c) => setCfg({ hasSim: c })} /> Has SIM card</label>
                  <label className="flex items-center gap-2"><Switch checked={!!edit.config.hasOs} onCheckedChange={(c) => setCfg({ hasOs: c })} /> Track OS updates</label>
                  <label className="flex items-center gap-2"><Switch checked={!!edit.config.uniqueName} onCheckedChange={(c) => setCfg({ uniqueName: c })} /> Device names should be unique</label>
                  <label className="flex items-center gap-2"><Switch checked={edit.active} onCheckedChange={(c) => setEdit({ ...edit, active: c })} /> Active</label>
                </div>
              </FormSection>
              <FormSection title="Field labels" description="Optional: rename standard fields for this type (e.g. VHF → Local Code, MPL Code).">
                {(["deviceName", "inventoryNumber", "assetNumber", "alternateReference", "shift"] as CoreLabelKey[]).map((k) => (
                  <Field key={k} label={CORE_LABELS[k]}>
                    <Input placeholder={CORE_LABELS[k]} value={edit.config.labels?.[k] ?? ""} onChange={(e) => setCfg({ labels: { ...edit.config.labels, [k]: e.target.value } })} />
                  </Field>
                ))}
              </FormSection>
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">Extra fields</h4>
                  <Button size="sm" variant="outline" onClick={() => setCfg({ extraFields: [...fields, { key: "", label: "", type: "text" }] })}><Plus /> Add field</Button>
                </div>
                {fields.length === 0 && <p className="text-[13px] text-muted-foreground">No extra fields.</p>}
                {fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_130px_auto]">
                    <Input placeholder="Label (e.g. Charger status)" value={f.label} onChange={(e) => setField(i, { label: e.target.value, key: f.key || e.target.value.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toLowerCase()) })} />
                    <Input placeholder="key" value={f.key} onChange={(e) => setField(i, { key: e.target.value })} className="font-mono text-xs" />
                    <NativeSelect value={f.type} onChange={(e) => setField(i, { type: e.target.value as ExtraField["type"] })}>
                      <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option><option value="boolean">Yes / No</option>
                    </NativeSelect>
                    <Button size="icon" variant="ghost" onClick={() => setCfg({ extraFields: fields.filter((_, j) => j !== i) })} aria-label="Remove field"><Trash2 /></Button>
                    {f.type === "select" && (
                      <Input className="sm:col-span-4" placeholder="Options, comma-separated" value={(f.options ?? []).join(", ")} onChange={(e) => setField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                    )}
                  </div>
                ))}
              </section>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} loading={pending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
