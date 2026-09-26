import type { StatusCode } from "@prisma/client";

/**
 * Which operations are possible from which current status.
 * Shared by the server (enforcement) and the forms (so users see why an action is unavailable).
 */
export type OperationKey =
  | "ISSUE" | "TRANSFER" | "RETURN" | "DISPOSE" | "MARK_LOST" | "REPAIR_OUT" | "REPAIR_IN" | "MARK_DAMAGED" | "VERIFY" | "OS_UPDATE";

type Rule = { label: string; allowed: StatusCode[] | null; blocked: StatusCode[] };

export const OPERATION_RULES: Record<OperationKey, Rule> = {
  ISSUE: { label: "Issue", allowed: ["IN_STOCK", "NOT_IN_USE", "UNVERIFIED"], blocked: ["DISPOSED", "LOST", "UNDER_REPAIR", "DAMAGED"] },
  TRANSFER: { label: "Transfer", allowed: null, blocked: ["DISPOSED", "LOST", "UNDER_REPAIR"] },
  RETURN: { label: "Return", allowed: null, blocked: ["DISPOSED", "LOST", "UNDER_REPAIR", "IN_STOCK"] },
  DISPOSE: { label: "Disposal", allowed: null, blocked: ["DISPOSED", "UNDER_REPAIR"] },
  MARK_LOST: { label: "Mark lost", allowed: null, blocked: ["DISPOSED", "LOST"] },
  REPAIR_OUT: { label: "Repair Out", allowed: null, blocked: ["DISPOSED", "LOST", "UNDER_REPAIR"] },
  REPAIR_IN: { label: "Repair In", allowed: ["UNDER_REPAIR"], blocked: [] },
  MARK_DAMAGED: { label: "Damage report", allowed: null, blocked: ["DISPOSED", "LOST"] },
  VERIFY: { label: "Verification", allowed: null, blocked: ["DISPOSED"] },
  OS_UPDATE: { label: "OS update", allowed: null, blocked: ["DISPOSED"] },
};

const HINTS: Partial<Record<OperationKey, Partial<Record<StatusCode, string>>>> = {
  ISSUE: { IN_USE: "It is already issued — use Transfer to move it or Return it first." },
  REPAIR_IN: {},
  RETURN: { IN_STOCK: "It is already in stock." },
};

/** null when allowed; otherwise a human explanation. */
export function operationBlockedReason(op: OperationKey, status: { code: StatusCode; name: string }, assetCode: string): string | null {
  const rule = OPERATION_RULES[op];
  const blocked = rule.blocked.includes(status.code) || (rule.allowed !== null && status.code !== "CUSTOM" && !rule.allowed.includes(status.code));
  if (!blocked) return null;
  const hint = HINTS[op]?.[status.code];
  if (op === "REPAIR_IN") return `Repair In is only possible for assets currently Under Repair. ${assetCode} is "${status.name}".`;
  return `${rule.label} is not possible: ${assetCode} is currently "${status.name}".${hint ? ` ${hint}` : ""}`;
}
