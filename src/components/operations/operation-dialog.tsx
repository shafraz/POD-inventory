"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftRight, PackageOpen, Undo2, Wrench, ShieldCheck, TriangleAlert, Trash2, SearchX, RefreshCw, Send, CircleCheck, Info, MapPin, User2,
} from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ConfirmDialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea, Checkbox, Switch } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/forms/field";
import { AssetPicker } from "@/components/assets/asset-picker";
import { StaffPicker } from "@/components/staff/staff-picker";
import { getStaffOptionAction } from "@/app/actions/staff";
import type { StaffOption } from "@/lib/services/staff";
import { useApp, type OperationKind, type OperationRequest } from "@/components/app/app-context";
import { lookupAssetAction } from "@/app/actions/assets";
import * as A from "@/app/actions/operations";
import type { AssetLookup } from "@/lib/services/assets";
import type { Permission } from "@/lib/auth/permissions";
import { operationBlockedReason, type OperationKey } from "@/lib/operation-rules";
import { cn, formatDate, todayISO } from "@/lib/utils";

type Meta = { title: string; description: string; icon: React.ElementType; perm: Permission; submit: string; tone: string };

const META: Record<OperationKind, Meta> = {
  ISSUE: { title: "Issue Asset", description: "Hand an in-stock asset to a person, shift or unit.", icon: PackageOpen, perm: "movement.record", submit: "Issue Asset", tone: "bg-emerald-50 text-emerald-600" },
  TRANSFER: { title: "Transfer Asset", description: "Move an asset to a new location and/or assignee.", icon: ArrowLeftRight, perm: "movement.record", submit: "Transfer", tone: "bg-teal-50 text-teal-600" },
  RETURN: { title: "Return Asset", description: "Bring an asset back into stock.", icon: Undo2, perm: "movement.record", submit: "Record Return", tone: "bg-sky-50 text-sky-600" },
  REPAIR_OUT: { title: "Send for Repair", description: "Record a repair-out; status becomes Under Repair.", icon: Wrench, perm: "repair.manage", submit: "Send for Repair", tone: "bg-orange-50 text-orange-600" },
  REPAIR_IN: { title: "Return from Repair", description: "Close the open repair and restore the asset's status.", icon: CircleCheck, perm: "repair.manage", submit: "Record Repair In", tone: "bg-blue-50 text-blue-600" },
  MARK_DAMAGED: { title: "Report Damage", description: "Record damage; status becomes Damaged.", icon: TriangleAlert, perm: "damage.report", submit: "Report Damage", tone: "bg-red-50 text-red-600" },
  VERIFY: { title: "Verify Asset", description: "Physical verification against the register.", icon: ShieldCheck, perm: "verify", submit: "Record Verification", tone: "bg-violet-50 text-violet-600" },
  DISPOSE: { title: "Dispose Asset", description: "Permanently remove an asset from active inventory.", icon: Trash2, perm: "movement.record", submit: "Dispose", tone: "bg-slate-100 text-slate-600" },
  MARK_LOST: { title: "Mark as Lost", description: "Record a missing asset. A reason is required.", icon: SearchX, perm: "movement.record", submit: "Mark Lost", tone: "bg-slate-800 text-white" },
  OS_UPDATE: { title: "Record OS Update", description: "Log an operating-system update for a tablet or PC.", icon: RefreshCw, perm: "os.update", submit: "Save OS Update", tone: "bg-amber-50 text-amber-600" },
  REQUEST: { title: "Request Movement / Repair", description: "Raise a request for an Inventory Officer to action.", icon: Send, perm: "movement.request", submit: "Submit Request", tone: "bg-blue-50 text-blue-600" },
};

type V = Record<string, string | boolean | null | undefined>;

function defaultsFor(kind: OperationKind, userName: string): V {
  const base: V = { date: todayISO(), doneBy: userName, notes: "" };
  switch (kind) {
    case "REPAIR_IN": return { ...base, repairCompleted: true };
    case "MARK_DAMAGED": return { ...base, severity: "MODERATE", reportedBy: userName };
    case "VERIFY": return { ...base, result: "VERIFIED", devicePresent: true, serialConfirmed: false, assetNumberConfirmed: false, locationMatches: false, assignmentMatches: false, conditionChecked: false, updateRegister: true };
    case "REPAIR_OUT": return { ...base, sentBy: userName };
    case "REQUEST": return { ...base, requestType: "TRANSFER" };
    default: return base;
  }
}

export function OperationDialog({ request, onClose }: { request: OperationRequest | null; onClose: () => void }) {
  const { ref, can, user } = useApp();
  const router = useRouter();
  const [kind, setKind] = React.useState<OperationKind>("ISSUE");
  const [assetDbId, setAssetDbId] = React.useState<string | null>(null);
  const [asset, setAsset] = React.useState<AssetLookup | null>(null);
  const [loadingAsset, setLoadingAsset] = React.useState(false);
  const [v, setV] = React.useState<V>({});
  const [files, setFiles] = React.useState<File[]>([]);
  const [staff, setStaff] = React.useState<StaffOption | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const available = (Object.keys(META) as OperationKind[]).filter((k) => {
    if (k === "REQUEST") return can("movement.request") && !can("movement.record");
    return can(META[k].perm);
  });

  const set = (k: string, val: V[string]) => setV((p) => ({ ...p, [k]: val }));

  const loadAsset = React.useCallback(async (id: string | null) => {
    setAssetDbId(id);
    setAsset(null);
    if (!id) return;
    setLoadingAsset(true);
    const a = await lookupAssetAction(id);
    setLoadingAsset(false);
    if (a) {
      setAsset(a);
      setAssetDbId(a.id);
    }
  }, []);

  // Reset whenever a new request opens the dialog
  React.useEffect(() => {
    if (!request) return;
    setKind(request.kind);
    setV({ ...defaultsFor(request.kind, user.name), ...(request.prefill as V | undefined) });
    setErrors({});
    setFiles([]);
    setStaff(null);
    const sid = (request.prefill as V | undefined)?.staffId;
    if (typeof sid === "string" && sid) getStaffOptionAction(sid).then((o) => o && setStaff(o));
    loadAsset(request.assetId ?? null);
  }, [request, user.name, loadAsset]);

  // Defaults that depend on the selected asset
  React.useEffect(() => {
    if (!asset) return;
    setV((p) => {
      const n = { ...p };
      if (kind === "VERIFY") {
        n.physicalLocationId ??= asset.locationId ?? "";
        n.assignedUser ??= asset.assignedTo ?? "";
        n.condition ??= asset.condition ?? "";
      }
      if (kind === "RETURN" && !n.returnedBy && asset.assignedTo) n.returnedBy = asset.assignedTo;
      if (kind === "RETURN" && !n.toLocationId) {
        const store = ref.locations.find((l) => /gear store/i.test(l.name));
        n.toLocationId = store?.id ?? asset.locationId ?? "";
      }
      if (kind === "MARK_DAMAGED" && !n.location) n.location = asset.location ?? "";
      if (kind === "REPAIR_IN" && !n.technician && asset.openRepair?.technician) n.technician = asset.openRepair.technician;
      return n;
    });
  }, [asset, kind, ref.locations]);

  // A pre-selected staff member (e.g. "Issue device" from their page) brings their shift
  React.useEffect(() => {
    if (staff?.shift && ref.shifts.includes(staff.shift)) setV((p) => (p.shift ? p : { ...p, shift: staff.shift! }));
  }, [staff, ref.shifts]);

  const changeKind = (k: OperationKind) => {
    setKind(k);
    setV((p) => ({ ...defaultsFor(k, user.name), date: p.date, doneBy: p.doneBy }));
    setStaff(null);
    setErrors({});
  };

  const blocked = asset && kind !== "REQUEST" ? operationBlockedReason(kind === "VERIFY" ? "VERIFY" : (kind as OperationKey), { code: asset.statusCode, name: asset.status }, asset.assetId) : null;
  const locName = (id?: string | null) => ref.locations.find((l) => l.id === id)?.name ?? "—";
  const meta = META[kind];
  const needsConfirm = kind === "TRANSFER" || kind === "DISPOSE" || kind === "MARK_LOST";

  const s = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const b = (k: string) => v[k] === true;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!assetDbId) return setErrors({ assetId: "Select an asset" });
    if (blocked) return toast.error(blocked);
    if (needsConfirm && !confirmOpen) return setConfirmOpen(true);
    run();
  };

  const run = () =>
    startTransition(async () => {
      const common = { assetId: assetDbId!, date: s("date"), doneBy: s("doneBy") || null, notes: s("notes") || null, requestId: request?.requestId ?? null };
      let res: { ok: boolean; error?: string; fieldErrors?: Record<string, string> };
      switch (kind) {
        case "ISSUE":
          res = await A.issueAction({ ...common, toLocationId: s("toLocationId"), staffId: staff?.id ?? null, assignedTo: staff ? null : s("assignedTo") || null, shift: s("shift") || null, department: s("department") || null });
          break;
        case "TRANSFER":
          res = await A.transferAction({ ...common, toLocationId: s("toLocationId"), staffId: staff?.id ?? null, assignedTo: staff ? null : s("assignedTo") || null, shift: s("shift") || null, reason: s("reason") || null });
          break;
        case "RETURN":
          res = await A.returnAction({ ...common, toLocationId: s("toLocationId"), returnedBy: s("returnedBy") || null, condition: s("condition") || null });
          break;
        case "REPAIR_OUT":
          res = await A.repairOutAction({ ...common, doneBy: s("sentBy") || common.doneBy, reportedProblem: s("reportedProblem"), condition: s("condition") || null, sentBy: s("sentBy") || null, technician: s("technician") || null, expectedReturnDate: s("expectedReturnDate") || null });
          break;
        case "REPAIR_IN":
          res = await A.repairInAction({ ...common, repairCompleted: b("repairCompleted"), repairDescription: s("repairDescription") || null, partsReplaced: s("partsReplaced") || null, cost: s("cost") || null, technician: s("technician") || null, conditionAfter: s("conditionAfter") || null, statusAfterId: s("statusAfterId") || null, toLocationId: s("toLocationId") || null });
          break;
        case "VERIFY":
          res = await A.verifyAction({
            ...common, physicalLocationId: s("physicalLocationId") || null, assignedUser: s("assignedUser") || null, condition: s("condition") || null,
            devicePresent: b("devicePresent"), serialConfirmed: b("serialConfirmed"), assetNumberConfirmed: b("assetNumberConfirmed"), locationMatches: b("locationMatches"),
            assignmentMatches: b("assignmentMatches"), conditionChecked: b("conditionChecked"), result: s("result") as "VERIFIED", statusAfterId: s("statusAfterId") || null, updateRegister: b("updateRegister"),
          });
          break;
        case "DISPOSE":
          res = await A.disposeAction({ ...common, reason: s("reason"), confirm: true });
          break;
        case "MARK_LOST":
          res = await A.lostAction({ ...common, reason: s("reason") });
          break;
        case "OS_UPDATE":
          res = await A.osUpdateAction({ ...common, osVersion: s("osVersion") || null });
          break;
        case "REQUEST":
          res = await A.requestAction({ type: s("requestType") as "TRANSFER", assetId: assetDbId!, toLocationId: s("toLocationId") || null, staffId: staff?.id ?? null, assignedTo: staff ? null : s("assignedTo") || null, shift: s("shift") || null, problem: s("problem") || null, notes: s("notes") || null });
          break;
        case "MARK_DAMAGED": {
          const fd = new FormData();
          fd.set("assetId", assetDbId!);
          fd.set("date", s("date"));
          fd.set("description", s("description"));
          fd.set("severity", s("severity"));
          fd.set("reportedBy", s("reportedBy"));
          fd.set("location", s("location"));
          fd.set("notes", s("notes"));
          files.forEach((f) => fd.append("photos", f));
          res = await A.damageAction(fd);
          break;
        }
      }
      setConfirmOpen(false);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not save");
        return;
      }
      toast.success(kind === "REQUEST" ? "Request submitted" : `${meta.title.replace(/ Asset$/, "")} recorded for ${asset?.assetId}`);
      onClose();
      router.refresh();
    });

  const confirmText = () => {
    if (!asset) return "";
    if (kind === "TRANSFER") return `Are you sure you want to transfer ${asset.assetId} from ${asset.location ?? "—"} to ${locName(s("toLocationId"))}?`;
    if (kind === "DISPOSE") return "Disposing an asset is a permanent inventory action. Continue?";
    return `Mark ${asset.assetId} as Lost? This will raise a notification to all inventory staff.`;
  };

  const locationSelect = (key: string, placeholder = "Select location…") => (
    <NativeSelect value={s(key)} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} data-testid={`field-${key}`}>
      {ref.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </NativeSelect>
  );
  const listSelect = (key: string, options: string[], placeholder = "—") => (
    <NativeSelect value={s(key)} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} data-testid={`field-${key}`}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </NativeSelect>
  );
  const text = (key: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input value={s(key)} onChange={(e) => set(key, e.target.value)} data-testid={`field-${key}`} {...props} />
  );
  const dateField = (key = "date", label = "Date", required = true) => (
    <Field label={label} required={required} error={errors[key]}>{text(key, { type: "date", max: key === "date" ? todayISO() : undefined })}</Field>
  );
  const notesField = (label = "Notes") => (
    <Field label={label} className="sm:col-span-2" error={errors.notes}>
      <Textarea value={s("notes")} onChange={(e) => set("notes", e.target.value)} rows={2} data-testid="field-notes" />
    </Field>
  );

  return (
    <>
      <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="lg" aria-describedby={undefined}>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" data-testid="operation-form">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", meta.tone)}><meta.icon className="size-[18px]" /></span>
                <div className="min-w-0">
                  <DialogTitle>{request?.requestId ? `Action request · ${meta.title}` : meta.title}</DialogTitle>
                  <DialogDescription>{meta.description}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Action">
                  <NativeSelect value={kind} onChange={(e) => changeKind(e.target.value as OperationKind)} disabled={!!request?.requestId} data-testid="field-action">
                    {available.map((k) => <option key={k} value={k}>{META[k].title}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Asset ID" required error={errors.assetId}>
                  <AssetPicker value={assetDbId} label={asset?.assetId ?? (loadingAsset ? "Loading…" : null)} onChange={(id) => loadAsset(id)} invalid={!!errors.assetId} disabled={!!request?.requestId} />
                </Field>
              </div>

              {asset && (
                <div className="rounded-lg border bg-slate-50/70 p-3" data-testid="asset-summary">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{asset.assetId}</span>
                    <span className="text-[13px] text-slate-600">{asset.deviceName}</span>
                    <Badge color={asset.statusColor} dot>{asset.status}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
                    <div><div className="text-slate-400">Type</div><div className="font-medium text-slate-800">{asset.assetType}</div></div>
                    <div><div className="text-slate-400">Current location</div><div className="font-medium text-slate-800" data-testid="current-location">{asset.location ?? "—"}</div></div>
                    <div><div className="text-slate-400">Assigned to</div><div className="font-medium text-slate-800">{asset.assignedTo ?? "—"}{asset.staff && <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">{asset.staff.employeeNumber}</span>}</div></div>
                    <div><div className="text-slate-400">Serial / IMEI</div><div className="truncate font-mono font-medium text-slate-800">{asset.serial ?? "—"}</div></div>
                  </div>
                  {asset.openRepair && (
                    <div className="mt-2 text-[12px] text-orange-700">Open repair since {formatDate(asset.openRepair.since)}: {asset.openRepair.problem}</div>
                  )}
                </div>
              )}

              {blocked && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800" data-testid="blocked-reason">
                  <Info className="mt-0.5 size-4 shrink-0" /> {blocked}
                </div>
              )}

              {asset && !blocked && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {kind === "ISSUE" && (
                    <>
                      <Field label="From location"><Input value={asset.location ?? "—"} disabled /></Field>
                      <Field label="To location" required error={errors.toLocationId}>{locationSelect("toLocationId")}</Field>
                      <Field label="Issue to staff member" error={errors.staffId}>
                        <StaffPicker value={staff} onChange={(o: StaffOption | null) => {
                        setStaff(o);
                        if (o?.shift && ref.shifts.includes(o.shift)) set("shift", o.shift);
                      }} invalid={!!errors.assignedTo && !staff} />
                      </Field>
                      <Field label="Or assign to unit / shift" error={staff ? undefined : errors.assignedTo} hint={staff ? "Not needed — staff member selected" : "e.g. C Yard, B Tallies (when not issued to a person)"}>
                        {text("assignedTo", { disabled: !!staff })}
                      </Field>
                      <Field label="Shift">{listSelect("shift", ref.shifts)}</Field>
                      <Field label="Department">{listSelect("department", ref.departments)}</Field>
                      {dateField()}
                      <Field label="Done by">{text("doneBy")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "TRANSFER" && (
                    <>
                      <Field label="Current location"><div className="flex h-9 items-center gap-1.5 rounded-md border bg-slate-50 px-3 text-sm"><MapPin className="size-3.5 text-slate-400" />{asset.location ?? "—"}</div></Field>
                      <Field label="New location" required error={errors.toLocationId}>{locationSelect("toLocationId")}</Field>
                      <Field label="Current assignee"><div className="flex h-9 items-center gap-1.5 rounded-md border bg-slate-50 px-3 text-sm"><User2 className="size-3.5 text-slate-400" />{asset.assignedTo ?? "—"}{asset.staff && <span className="font-mono text-xs text-muted-foreground">{asset.staff.employeeNumber}</span>}</div></Field>
                      <Field label="New holder (staff member)">
                        <StaffPicker value={staff} onChange={(o: StaffOption | null) => {
                        setStaff(o);
                        if (o?.shift && ref.shifts.includes(o.shift)) set("shift", o.shift);
                      }} />
                      </Field>
                      <Field label="Or other assignee" hint={staff ? "Not needed — staff member selected" : "Leave both blank to keep the current assignee"}>
                        {text("assignedTo", { placeholder: asset.assignedTo ?? "", disabled: !!staff })}
                      </Field>
                      <Field label="Shift">{listSelect("shift", ref.shifts)}</Field>
                      {dateField()}
                      <Field label="Reason">{text("reason")}</Field>
                      <Field label="Done by">{text("doneBy")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "RETURN" && (
                    <>
                      <Field label="Current location"><Input value={asset.location ?? "—"} disabled /></Field>
                      <Field label="Return location" required error={errors.toLocationId}>{locationSelect("toLocationId")}</Field>
                      <Field label="Returned by">{text("returnedBy", { placeholder: asset.assignedTo ?? "" })}</Field>
                      <Field label="Condition" hint="Damaged / Critical sets the status to Damaged">{listSelect("condition", ref.conditions)}</Field>
                      {dateField()}
                      <Field label="Received by">{text("doneBy")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "REPAIR_OUT" && (
                    <>
                      <Field label="Reported problem" required error={errors.reportedProblem} className="sm:col-span-2"><Textarea value={s("reportedProblem")} onChange={(e) => set("reportedProblem", e.target.value)} rows={2} data-testid="field-reportedProblem" /></Field>
                      {dateField()}
                      <Field label="Condition">{listSelect("condition", ref.conditions)}</Field>
                      <Field label="Repair vendor / technician">{text("technician")}</Field>
                      <Field label="Expected return date">{text("expectedReturnDate", { type: "date" })}</Field>
                      <Field label="Sent by">{text("sentBy")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "REPAIR_IN" && (
                    <>
                      {dateField("date", "Return date")}
                      <Field label="Repair completed?">
                        <NativeSelect value={b("repairCompleted") ? "yes" : "no"} onChange={(e) => set("repairCompleted", e.target.value === "yes")} data-testid="field-repairCompleted">
                          <option value="yes">Yes — repaired</option>
                          <option value="no">No — not repairable</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Repair description" className="sm:col-span-2"><Textarea value={s("repairDescription")} onChange={(e) => set("repairDescription", e.target.value)} rows={2} data-testid="field-repairDescription" /></Field>
                      <Field label="Parts replaced">{text("partsReplaced")}</Field>
                      <Field label="Cost (MVR)" error={errors.cost}>{text("cost", { type: "number", min: 0, step: "0.01" })}</Field>
                      <Field label="Technician">{text("technician")}</Field>
                      <Field label="Condition after repair">{listSelect("conditionAfter", ref.conditions)}</Field>
                      <Field label="Status after repair" hint="Automatic: previous status if repaired, Damaged if not">
                        <NativeSelect value={s("statusAfterId")} onChange={(e) => set("statusAfterId", e.target.value)} placeholder="Automatic">
                          {ref.statuses.filter((st) => st.code !== "UNDER_REPAIR").map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </NativeSelect>
                      </Field>
                      <Field label="Return to location" hint="Leave blank to keep current">{locationSelect("toLocationId", "Keep current")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "MARK_DAMAGED" && (
                    <>
                      <Field label="Damage description" required error={errors.description} className="sm:col-span-2"><Textarea value={s("description")} onChange={(e) => set("description", e.target.value)} rows={2} data-testid="field-description" /></Field>
                      <Field label="Severity" required>
                        <NativeSelect value={s("severity")} onChange={(e) => set("severity", e.target.value)} data-testid="field-severity">
                          <option value="MINOR">Minor</option><option value="MODERATE">Moderate</option><option value="MAJOR">Major</option><option value="CRITICAL">Critical</option>
                        </NativeSelect>
                      </Field>
                      {dateField()}
                      <Field label="Reported by">{text("reportedBy")}</Field>
                      <Field label="Location">{text("location")}</Field>
                      <Field label="Photos" className="sm:col-span-2" hint="Up to 5 images or PDFs, 5 MB each">
                        <Input type="file" accept="image/*,application/pdf" multiple capture="environment" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
                      </Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "VERIFY" && (
                    <>
                      {dateField("date", "Verification date")}
                      <Field label="Verification result" required>
                        <NativeSelect value={s("result")} onChange={(e) => set("result", e.target.value)} data-testid="field-result">
                          <option value="VERIFIED">Verified OK</option>
                          <option value="DISCREPANCY">Verified with discrepancy</option>
                          <option value="NOT_FOUND">Not found (mark Lost)</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Physical location">{locationSelect("physicalLocationId")}</Field>
                      <Field label="Assigned user (found with)">{text("assignedUser")}</Field>
                      <Field label="Physical condition">{listSelect("condition", ref.conditions)}</Field>
                      <Field label="Status after verification" hint={asset.statusCode === "UNVERIFIED" ? "Automatic: In Use if assigned, otherwise In Stock" : "Automatic: unchanged"}>
                        <NativeSelect value={s("statusAfterId")} onChange={(e) => set("statusAfterId", e.target.value)} placeholder="Automatic">
                          {ref.statuses.filter((st) => st.code !== "UNDER_REPAIR").map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </NativeSelect>
                      </Field>
                      <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2">
                        {([
                          ["devicePresent", "Device physically present"],
                          ["serialConfirmed", "Serial / IMEI matches"],
                          ["assetNumberConfirmed", "Asset number matches"],
                          ["locationMatches", "Location matches"],
                          ["assignmentMatches", "Assignment matches"],
                          ["conditionChecked", "Device condition checked"],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="flex cursor-pointer items-center gap-2 text-[13px]">
                            <Checkbox checked={b(k)} onCheckedChange={(c) => set(k, c === true)} data-testid={`check-${k}`} /> {label}
                          </label>
                        ))}
                        <button type="button" className="text-left text-xs font-medium text-primary hover:underline sm:col-span-2" onClick={() => setV((p) => ({ ...p, devicePresent: true, serialConfirmed: true, assetNumberConfirmed: true, locationMatches: true, assignmentMatches: true, conditionChecked: true }))}>
                          Tick all
                        </button>
                      </div>
                      <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                        <Switch checked={b("updateRegister")} onCheckedChange={(c) => set("updateRegister", c)} /> Update the register with the location / assignment found
                      </label>
                      <Field label="Verified by">{text("doneBy")}</Field>
                      {notesField("Remarks")}
                    </>
                  )}
                  {(kind === "DISPOSE" || kind === "MARK_LOST") && (
                    <>
                      <Field label="Reason" required error={errors.reason} className="sm:col-span-2">{text("reason", { placeholder: kind === "DISPOSE" ? "e.g. Beyond economical repair" : "e.g. Not returned after shift" })}</Field>
                      {dateField()}
                      <Field label="Done by">{text("doneBy")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "OS_UPDATE" && (
                    <>
                      {dateField("date", "Update date")}
                      <Field label="OS version">{text("osVersion", { placeholder: "e.g. Android 14" })}</Field>
                      <Field label="Updated by">{text("doneBy")}</Field>
                      {notesField()}
                    </>
                  )}
                  {kind === "REQUEST" && (
                    <>
                      <Field label="Request type" required>
                        <NativeSelect value={s("requestType")} onChange={(e) => set("requestType", e.target.value)}>
                          <option value="ISSUE">Issue</option><option value="TRANSFER">Transfer</option><option value="RETURN">Return</option><option value="REPAIR">Repair required</option>
                        </NativeSelect>
                      </Field>
                      {s("requestType") !== "REPAIR" && <Field label="To location">{locationSelect("toLocationId")}</Field>}
                      {(s("requestType") === "ISSUE" || s("requestType") === "TRANSFER") && (
                        <>
                          <Field label="Issue to staff member"><StaffPicker value={staff} onChange={(o) => setStaff(o)} /></Field>
                          <Field label="Or other assignee">{text("assignedTo", { disabled: !!staff })}</Field>
                        </>
                      )}
                      {s("requestType") === "REPAIR" && <Field label="Problem" required className="sm:col-span-2"><Textarea value={s("problem")} onChange={(e) => set("problem", e.target.value)} rows={2} /></Field>}
                      {notesField()}
                    </>
                  )}
                </div>
              )}
              {!asset && staff && (
                <div className="rounded-md border bg-muted px-3 py-2 text-[13px]" data-testid="staff-banner">
                  Issuing to <b>{staff.name}</b> <span className="font-mono text-xs text-muted-foreground">{staff.employeeNumber}</span>{staff.designation ? ` · ${staff.designation}` : ""} — now choose the device.
                </div>
              )}
              {!asset && !loadingAsset && <p className="text-[13px] text-muted-foreground">Select an asset — its current location, status and assignee will be shown automatically.</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={pending} disabled={!asset || !!blocked} variant={kind === "DISPOSE" || kind === "MARK_LOST" ? "destructive" : "default"} data-testid="operation-submit">
                {meta.submit}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={kind === "TRANSFER" ? "Transfer Asset" : kind === "DISPOSE" ? "Dispose Asset" : "Mark as Lost"}
        description={confirmText()}
        confirmLabel={kind === "TRANSFER" ? "Confirm Transfer" : kind === "DISPOSE" ? "Dispose Asset" : "Mark Lost"}
        destructive={kind !== "TRANSFER"}
        loading={pending}
        onConfirm={run}
      />
    </>
  );
}
