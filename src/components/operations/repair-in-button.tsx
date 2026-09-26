"use client";

import { CircleCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, type OperationKind } from "@/components/app/app-context";

export function RepairInButton({ assetId }: { assetId: string }) {
  const { openOperation } = useApp();
  return (
    <Button size="sm" variant="outline" onClick={() => openOperation({ kind: "REPAIR_IN", assetId })} data-testid="repair-in">
      <CircleCheck /> Repair In
    </Button>
  );
}

export function OperationButton({ kind, assetId, label }: { kind: OperationKind; assetId: string; label: string }) {
  const { openOperation, can } = useApp();
  if (kind === "VERIFY" && !can("verify")) return null;
  return (
    <Button size="sm" variant="outline" onClick={() => openOperation({ kind, assetId })}>
      <ShieldCheck /> {label}
    </Button>
  );
}
