"use client";

import * as React from "react";
import { PackageOpen, Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/app-context";
import { StaffFormDialog, type StaffFormValues } from "./staff-form-dialog";

export function StaffDetailActions({ staff, designations }: { staff: StaffFormValues & { id: string }; designations: string[] }) {
  const { can, openOperation } = useApp();
  const [edit, setEdit] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {can("movement.record") && staff.active && (
        <Button size="sm" onClick={() => openOperation({ kind: "ISSUE", prefill: { staffId: staff.id } })} data-testid="issue-to-staff">
          <PackageOpen /> Issue device
        </Button>
      )}
      {can("staff.manage") && <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit</Button>}
      <StaffFormDialog open={edit} onOpenChange={setEdit} initial={staff} designations={designations} />
    </div>
  );
}

export function ReturnDeviceButton({ assetId }: { assetId: string }) {
  const { can, openOperation } = useApp();
  if (!can("movement.record")) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => openOperation({ kind: "RETURN", assetId })} data-testid="return-device">
      <Undo2 /> Return
    </Button>
  );
}
