"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Pencil } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea, Switch } from "@/components/ui/primitives";
import { Field, FormSection } from "@/components/forms/field";
import { useApp } from "@/components/app/app-context";
import { createAssetAction, previewNextAssetId, updateAssetAction } from "@/app/actions/assets";
import { labelFor, type ExtraField } from "@/lib/asset-type-config";
import { isOthers } from "@/lib/register-fields";

export type AssetFormValues = {
  id?: string;
  assetId?: string;
  assetTypeId: string;
  deviceName: string;
  brand: string;
  model: string;
  serialNumber: string;
  imei: string;
  inventoryNumber: string;
  assetNumber: string;
  alternateReference: string;
  simOperator: string;
  simNumber: string;
  locationId: string;
  locationRemark: string;
  assignedTo: string;
  assignedToRemark: string;
  shift: string;
  department: string;
  statusId: string;
  condition: string;
  lastOsUpdate: string;
  osVersion: string;
  lastServiceDate: string;
  nextVerificationDate: string;
  receivedDate: string;
  remarks: string;
  attributes: Record<string, string | number | boolean | null>;
};

function blank(typeId: string, statusId: string): AssetFormValues {
  return {
    assetTypeId: typeId, deviceName: "", brand: "", model: "", serialNumber: "", imei: "", inventoryNumber: "", assetNumber: "",
    alternateReference: "", simOperator: "", simNumber: "", locationId: "", locationRemark: "", assignedTo: "", assignedToRemark: "", shift: "", department: "", statusId,
    condition: "Good", lastOsUpdate: "", osVersion: "", lastServiceDate: "", nextVerificationDate: "", receivedDate: "", remarks: "", attributes: {},
  };
}

export function AssetFormDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: AssetFormValues }) {
  const { ref } = useApp();
  const router = useRouter();
  const editing = !!initial?.id;
  const inStock = ref.statuses.find((s) => s.code === "IN_STOCK")?.id ?? ref.statuses[0]?.id ?? "";
  const [v, setV] = React.useState<AssetFormValues>(() => initial ?? blank(ref.types[0]?.id ?? "", inStock));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [nextId, setNextId] = React.useState<string | null>(null);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [pending, start] = React.useTransition();
  const firstField = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setV(initial ?? blank(ref.types[0]?.id ?? "", inStock));
      setErrors({});
      setPhoto(null);
    }
  }, [open, initial, ref.types, inStock]);

  React.useEffect(() => {
    if (!open || editing || !v.assetTypeId) return;
    previewNextAssetId(v.assetTypeId, v.receivedDate || null).then(setNextId);
  }, [open, editing, v.assetTypeId, v.receivedDate]);

  const type = ref.types.find((t) => t.id === v.assetTypeId);
  const cfg = type?.config ?? {};
  const set = <K extends keyof AssetFormValues>(k: K, val: AssetFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setAttr = (k: string, val: string | number | boolean | null) => setV((p) => ({ ...p, attributes: { ...p.attributes, [k]: val } }));

  const save = (another: boolean) =>
    start(async () => {
      const payload = { ...v, attributes: v.attributes };
      const res = editing ? await updateAssetAction({ ...payload, id: v.id! }) : await createAssetAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      if (photo) {
        const fd = new FormData();
        fd.set("file", photo);
        const up = await fetch(`/api/assets/${encodeURIComponent(res.data.assetId)}/attachments`, { method: "POST", body: fd });
        if (!up.ok) toast.warning("Asset saved, but the attachment could not be uploaded.");
      }
      toast.success(editing ? `${res.data.assetId} updated` : `${res.data.assetId} registered`);
      router.refresh();
      if (another) {
        setV((p) => ({ ...blank(p.assetTypeId, p.statusId), locationId: p.locationId, locationRemark: p.locationRemark, assignedTo: p.assignedTo, assignedToRemark: p.assignedToRemark, shift: p.shift, brand: p.brand, model: p.model, simOperator: p.simOperator, receivedDate: p.receivedDate }));
        setPhoto(null);
        previewNextAssetId(v.assetTypeId, v.receivedDate || null).then(setNextId);
        firstField.current?.focus();
      } else {
        onOpenChange(false);
        if (!editing) router.push(`/assets/${encodeURIComponent(res.data.assetId)}`);
      }
    });

  const inp = (k: keyof AssetFormValues, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input value={(v[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} data-testid={`asset-${k}`} {...props} />
  );
  const sel = (k: keyof AssetFormValues, options: string[], placeholder = "—") => (
    <NativeSelect value={(v[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} placeholder={placeholder} data-testid={`asset-${k}`}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      {v[k] && !options.includes(v[k] as string) ? <option value={v[k] as string}>{v[k] as string}</option> : null}
    </NativeSelect>
  );

  const extraInput = (f: ExtraField) => {
    const val = v.attributes[f.key];
    if (f.type === "select") {
      return (
        <NativeSelect value={(val as string) ?? ""} onChange={(e) => setAttr(f.key, e.target.value || null)} placeholder="—">
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </NativeSelect>
      );
    }
    if (f.type === "boolean") return <div className="flex h-9 items-center"><Switch checked={val === true} onCheckedChange={(c) => setAttr(f.key, c)} /></div>;
    return (
      <Input
        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
        value={val === null || val === undefined ? "" : String(val)}
        onChange={(e) => setAttr(f.key, f.type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null)}
        data-testid={`attr-${f.key}`}
      />
    );
  };

  const locOthers = isOthers(ref.locations.find((l) => l.id === v.locationId)?.name);
  const assignOthers = isOthers(v.assignedTo);
  const showImei = cfg.identifier === "imei" || !!v.imei;
  const showSerial = cfg.identifier !== "imei" || !!v.serialNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" aria-describedby={undefined}>
        <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="flex min-h-0 flex-1 flex-col" data-testid="asset-form">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">{editing ? <Pencil className="size-4" /> : <PlusCircle className="size-[18px]" />}</span>
              <div>
                <DialogTitle>{editing ? `Edit ${v.assetId}` : "Add Asset"}</DialogTitle>
                <DialogDescription>
                  {editing ? "Update the register. Location / status changes are normally made through movements." : <>Asset ID will be <span className="font-mono font-semibold text-slate-800" data-testid="next-asset-id">{nextId ?? "…"}</span> (generated automatically)</>}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <FormSection title="Basic information">
              <Field label="Asset type" required error={errors.assetTypeId}>
                <NativeSelect value={v.assetTypeId} onChange={(e) => set("assetTypeId", e.target.value)} disabled={editing} data-testid="asset-assetTypeId">
                  {ref.types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.prefix})</option>)}
                </NativeSelect>
              </Field>
              <Field label="Received date" hint={editing ? undefined : "Sets the year in the Asset ID"}>{inp("receivedDate", { type: "date" })}</Field>
              <Field label="Brand" error={errors.brand}>
                <Input ref={firstField} list="brand-list" value={v.brand} onChange={(e) => set("brand", e.target.value)} data-testid="asset-brand" autoFocus />
              </Field>
              <datalist id="brand-list">{ref.brands.map((b) => <option key={b} value={b} />)}</datalist>
              <Field label="Model">{inp("model")}</Field>
              {showImei && <Field label={labelFor(cfg, "imei")} error={errors.imei}>{inp("imei", { inputMode: "numeric" })}</Field>}
              {showSerial && <Field label={labelFor(cfg, "serialNumber")} error={errors.serialNumber}>{inp("serialNumber")}</Field>}
              <Field label={labelFor(cfg, "inventoryNumber")} error={errors.inventoryNumber}>{inp("inventoryNumber")}</Field>
              <Field label={labelFor(cfg, "assetNumber")} error={errors.assetNumber}>{inp("assetNumber")}</Field>
              <Field label="SIM / Operator">{sel("simOperator", ref.simOperators, "None")}</Field>
              {(cfg.hasSim || v.simNumber) && <Field label="SIM number">{inp("simNumber")}</Field>}
            </FormSection>

            {(cfg.extraFields?.length ?? 0) > 0 && (
              <FormSection title={`${type?.name} details`}>
                {cfg.extraFields!.map((f) => <Field key={f.key} label={f.label}>{extraInput(f)}</Field>)}
              </FormSection>
            )}

            <FormSection title="Location &amp; assignment">
              <Field label="Location" error={errors.locationId}>
                <NativeSelect value={v.locationId} onChange={(e) => set("locationId", e.target.value)} placeholder="— No location —" data-testid="asset-locationId">
                  {ref.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Location remark" required={locOthers} error={errors.locationRemark} hint={locOthers ? "Where exactly?" : "Optional"}>
                {inp("locationRemark", { placeholder: locOthers ? "e.g. COD, Marine Craft" : "" })}
              </Field>
              <Field label="Assigned To" error={errors.assignedTo}>{sel("assignedTo", ref.assignedUnits)}</Field>
              <Field label="Assigned To remark" required={assignOthers} error={errors.assignedToRemark} hint={assignOthers ? "Who / which unit?" : "Optional"}>
                {inp("assignedToRemark")}
              </Field>
              <Field label="Shift">{sel("shift", ref.shifts)}</Field>
            </FormSection>

            <FormSection title="Status">
              <Field label="Status" required error={errors.statusId}>
                <NativeSelect value={v.statusId} onChange={(e) => set("statusId", e.target.value)} data-testid="asset-statusId">
                  {ref.statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Condition">{sel("condition", ref.conditions)}</Field>
            </FormSection>

            <FormSection title="Maintenance">
              {(cfg.hasOs || v.lastOsUpdate) && <Field label="Last OS update">{inp("lastOsUpdate", { type: "date" })}</Field>}
              {(cfg.hasOs || v.osVersion) && <Field label="OS version">{inp("osVersion")}</Field>}
              <Field label="Last service date">{inp("lastServiceDate", { type: "date" })}</Field>
              <Field label="Next verification date" hint="Set automatically when the asset is verified">{inp("nextVerificationDate", { type: "date" })}</Field>
            </FormSection>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!editing && <Button type="button" variant="secondary" loading={pending} onClick={() => save(true)} data-testid="save-add-another">Save &amp; Add Another</Button>}
            <Button type="submit" loading={pending} data-testid="save-asset">{editing ? "Save Changes" : "Save Asset"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
