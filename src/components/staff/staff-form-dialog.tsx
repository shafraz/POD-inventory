"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Pencil } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Switch, Textarea } from "@/components/ui/primitives";
import { Field } from "@/components/forms/field";
import { useApp } from "@/components/app/app-context";
import { saveStaffAction } from "@/app/actions/staff";

export type StaffFormValues = {
  id?: string;
  name: string;
  employeeNumber: string;
  designation: string;
  shift: string;
  department: string;
  phone: string;
  notes: string;
  active: boolean;
  holding?: number;
};

const blank: StaffFormValues = { name: "", employeeNumber: "", designation: "", shift: "", department: "", phone: "", notes: "", active: true };

export function StaffFormDialog({
  open,
  onOpenChange,
  initial,
  designations,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: StaffFormValues | null;
  designations: string[];
}) {
  const { ref } = useApp();
  const router = useRouter();
  const editing = !!initial?.id;
  const [v, setV] = React.useState<StaffFormValues>(initial ?? blank);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setV(initial ?? blank);
      setErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof StaffFormValues>(k: K, val: StaffFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = (another: boolean) =>
    start(async () => {
      const res = await saveStaffAction({
        id: v.id ?? null, name: v.name, employeeNumber: v.employeeNumber, designation: v.designation || null, shift: v.shift || null,
        department: v.department || null, phone: v.phone || null, notes: v.notes || null, active: v.active,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(editing ? `${res.data.name} updated` : `${res.data.name} added to staff`);
      router.refresh();
      if (another) {
        // Keep designation / shift / department for fast entry of a whole shift
        setV((p) => ({ ...blank, designation: p.designation, shift: p.shift, department: p.department }));
        setErrors({});
        nameRef.current?.focus();
      } else onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="flex min-h-0 flex-1 flex-col" data-testid="staff-form">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">{editing ? <Pencil className="size-4" /> : <UserPlus className="size-[18px]" />}</span>
              <div>
                <DialogTitle>{editing ? `Edit ${initial?.name}` : "Add staff member"}</DialogTitle>
                <DialogDescription>People who receive and return tablets and VHF radios.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Staff name" required error={errors.name} className="sm:col-span-2">
              <Input ref={nameRef} value={v.name} onChange={(e) => set("name", e.target.value)} autoFocus data-testid="staff-name" />
            </Field>
            <Field label="Employee number" required error={errors.employeeNumber}>
              <Input value={v.employeeNumber} onChange={(e) => set("employeeNumber", e.target.value.toUpperCase())} className="font-mono" data-testid="staff-employeeNumber" />
            </Field>
            <Field label="Designation" error={errors.designation}>
              <Input list="designation-list" value={v.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Tally Clerk" data-testid="staff-designation" />
            </Field>
            <datalist id="designation-list">{designations.map((d) => <option key={d} value={d} />)}</datalist>
            <Field label="Shift" error={errors.shift}>
              <NativeSelect value={v.shift} onChange={(e) => set("shift", e.target.value)} placeholder="—" data-testid="staff-shift">
                {ref.shifts.map((s) => <option key={s} value={s}>{s}</option>)}
                {v.shift && !ref.shifts.includes(v.shift) && <option value={v.shift}>{v.shift}</option>}
              </NativeSelect>
            </Field>
            <Field label="Department">
              <NativeSelect value={v.department} onChange={(e) => set("department", e.target.value)} placeholder="—">
                {ref.departments.map((d) => <option key={d} value={d}>{d}</option>)}
                {v.department && !ref.departments.includes(v.department) && <option value={v.department}>{v.department}</option>}
              </NativeSelect>
            </Field>
            <Field label="Phone"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            {editing && (
              <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                <Switch checked={v.active} onCheckedChange={(c) => set("active", c)} /> Active (can receive devices)
              </label>
            )}
            {editing && !v.active && (initial?.holding ?? 0) > 0 && (
              <p className="text-xs text-amber-700 sm:col-span-2">{initial?.holding} device(s) are still with this person — record their return first.</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {!editing && <Button type="button" variant="secondary" loading={pending} onClick={() => save(true)} data-testid="staff-save-another">Save &amp; Add Another</Button>}
            <Button type="submit" loading={pending} data-testid="staff-save">{editing ? "Save Changes" : "Save Staff"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
