"use client";

import { ArrowLeftRight, Send, TriangleAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp, type OperationKind } from "@/components/app/app-context";
import type { Permission } from "@/lib/auth/permissions";

const permFor = (k: OperationKind): Permission =>
  k === "VERIFY" ? "verify" : k === "REPAIR_OUT" || k === "REPAIR_IN" ? "repair.manage" : k === "MARK_DAMAGED" ? "damage.report" : k === "OS_UPDATE" ? "os.update" : "movement.record";

/** Opens the operation dialog; Operations Users get "New Request" instead. */
const ICONS = { move: ArrowLeftRight, repair: Wrench, damage: TriangleAlert } as const;

export function RecordMovementButton({ kind = "TRANSFER", label = "Record Movement", icon = "move" }: { kind?: OperationKind; label?: string; icon?: keyof typeof ICONS }) {
  const { can, openOperation } = useApp();
  const Icon = ICONS[icon];
  if (can(permFor(kind))) {
    return (
      <Button size="sm" onClick={() => openOperation({ kind })} data-testid="record-movement">
        <Icon /> {label}
      </Button>
    );
  }
  if (can("movement.request")) {
    return (
      <Button size="sm" onClick={() => openOperation({ kind: "REQUEST", prefill: kind === "REPAIR_OUT" ? { requestType: "REPAIR" } : undefined })}>
        <Send /> New Request
      </Button>
    );
  }
  return null;
}
