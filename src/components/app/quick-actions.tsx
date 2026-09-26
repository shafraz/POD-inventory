"use client";

import { Plus, ArrowLeftRight, PackageOpen, Undo2, Wrench, ShieldCheck, TriangleAlert, Send, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { useApp, type OperationKind } from "./app-context";
import type { Permission } from "@/lib/auth/permissions";

export const QUICK_ACTIONS: { kind: OperationKind | "ADD"; label: string; icon: React.ElementType; perm: Permission; tone: string }[] = [
  { kind: "ADD", label: "Add Asset", icon: Plus, perm: "asset.create", tone: "text-blue-600 bg-blue-50" },
  { kind: "TRANSFER", label: "Transfer Asset", icon: ArrowLeftRight, perm: "movement.record", tone: "text-teal-600 bg-teal-50" },
  { kind: "ISSUE", label: "Issue Asset", icon: PackageOpen, perm: "movement.record", tone: "text-emerald-600 bg-emerald-50" },
  { kind: "RETURN", label: "Return Asset", icon: Undo2, perm: "movement.record", tone: "text-sky-600 bg-sky-50" },
  { kind: "REPAIR_OUT", label: "Send for Repair", icon: Wrench, perm: "repair.manage", tone: "text-orange-600 bg-orange-50" },
  { kind: "VERIFY", label: "Verify Asset", icon: ShieldCheck, perm: "verify", tone: "text-violet-600 bg-violet-50" },
  { kind: "MARK_DAMAGED", label: "Report Damage", icon: TriangleAlert, perm: "damage.report", tone: "text-red-600 bg-red-50" },
];

export function useQuickActions() {
  const { can, openOperation, openAddAsset } = useApp();
  const list = QUICK_ACTIONS.filter((a) => can(a.perm)).map((a) => ({
    ...a,
    run: () => (a.kind === "ADD" ? openAddAsset() : openOperation({ kind: a.kind as OperationKind })),
  }));
  if (!can("movement.record") && can("movement.request")) {
    list.push({ kind: "REQUEST", label: "Request Movement / Repair", icon: Send, perm: "movement.request", tone: "text-blue-600 bg-blue-50", run: () => openOperation({ kind: "REQUEST" }) });
  }
  return list;
}

export function QuickActionsMenu() {
  const actions = useQuickActions();
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5" data-testid="quick-actions">
          <Plus /> <span className="hidden sm:inline">New</span> <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((a) => (
          <DropdownMenuItem key={a.kind} onSelect={a.run}>
            <a.icon /> {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
