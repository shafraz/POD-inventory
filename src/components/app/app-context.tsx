"use client";

import * as React from "react";
import type { Role } from "@prisma/client";
import type { Permission } from "@/lib/auth/permissions";
import type { ReferenceData } from "@/lib/services/reference";

export type OperationKind =
  | "ISSUE" | "TRANSFER" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "MARK_DAMAGED" | "VERIFY" | "DISPOSE" | "MARK_LOST" | "OS_UPDATE" | "REQUEST";

export type OperationRequest = {
  kind: OperationKind;
  assetId?: string; // db id or asset code
  prefill?: Record<string, unknown>;
  requestId?: string;
};

type Ctx = {
  user: { id: string; name: string; email: string; role: Role };
  permissions: Permission[];
  can: (p: Permission) => boolean;
  ref: ReferenceData;
  settings: { organizationName: string; systemName: string; logo: string | null; verificationIntervalDays: number; dueSoonDays: number };
  openOperation: (op: OperationRequest) => void;
  openAddAsset: () => void;
};

const AppContext = React.createContext<Ctx | null>(null);

export function useApp() {
  const c = React.useContext(AppContext);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}

export function AppProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
