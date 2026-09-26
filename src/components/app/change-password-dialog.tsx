"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { Field } from "@/components/forms/field";
import { changeOwnPasswordAction } from "@/app/actions/admin";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setErrors({ confirm: "Passwords do not match" });
    start(async () => {
      const r = await changeOwnPasswordAction({ current, next });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>At least 8 characters, with letters and numbers.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Current password" error={errors.current} required>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="New password" error={errors.next} required>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" error={errors.confirm} required>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Update password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
