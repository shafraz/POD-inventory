import type { MovementAction, Role, DamageSeverity, VerificationResult, RepairStatus, RequestType } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  INVENTORY_OFFICER: "Inventory Officer",
  OPERATIONS_USER: "Operations User",
  VIEWER: "Viewer",
};

export const ACTION_LABELS: Record<MovementAction, string> = {
  ISSUE: "Issue",
  RETURN: "Return",
  TRANSFER: "Transfer",
  REPAIR_OUT: "Repair Out",
  REPAIR_IN: "Repair In",
  MARK_DAMAGED: "Mark Damaged",
  VERIFIED: "Verified",
  DISPOSE: "Dispose",
  MARK_LOST: "Mark Lost",
  OS_UPDATE: "OS Update",
  STATUS_CHANGE: "Status Change",
  REGISTERED: "Registered",
};

export const ACTION_COLORS: Record<MovementAction, string> = {
  ISSUE: "green",
  RETURN: "blue",
  TRANSFER: "teal",
  REPAIR_OUT: "orange",
  REPAIR_IN: "blue",
  MARK_DAMAGED: "red",
  VERIFIED: "purple",
  DISPOSE: "gray",
  MARK_LOST: "dark",
  OS_UPDATE: "yellow",
  STATUS_CHANGE: "gray",
  REGISTERED: "gray",
};

export const SEVERITY_LABELS: Record<DamageSeverity, string> = {
  MINOR: "Minor",
  MODERATE: "Moderate",
  MAJOR: "Major",
  CRITICAL: "Critical",
};

export const SEVERITY_COLORS: Record<DamageSeverity, string> = {
  MINOR: "yellow",
  MODERATE: "orange",
  MAJOR: "red",
  CRITICAL: "dark",
};

export const VERIFICATION_RESULT_LABELS: Record<VerificationResult, string> = {
  VERIFIED: "Verified OK",
  DISCREPANCY: "Verified with discrepancy",
  NOT_FOUND: "Not found",
};

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  OPEN: "At repair",
  COMPLETED: "Completed",
  NOT_REPAIRABLE: "Not repairable",
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  ISSUE: "Issue",
  TRANSFER: "Transfer",
  RETURN: "Return",
  REPAIR: "Repair",
};

export type VerificationState = "VERIFIED" | "DUE_SOON" | "OVERDUE";

export const VERIFICATION_STATE_LABELS: Record<VerificationState, string> = {
  VERIFIED: "Verified",
  DUE_SOON: "Due Soon",
  OVERDUE: "Overdue",
};

export const VERIFICATION_STATE_COLORS: Record<VerificationState, string> = {
  VERIFIED: "green",
  DUE_SOON: "orange",
  OVERDUE: "red",
};

export const SESSION_COOKIE = "mpl_session";
