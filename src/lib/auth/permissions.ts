import type { Role } from "@prisma/client";

/**
 * Role-based permission matrix. Every server action / route checks one of these;
 * the UI uses the same matrix to hide controls the user can't use.
 */
export type Permission =
  | "asset.view"
  | "staff.manage"
  | "asset.create"
  | "asset.edit"
  | "asset.delete"
  | "movement.record"
  | "movement.request"
  | "request.review"
  | "repair.manage"
  | "repair.request"
  | "damage.report"
  | "verify"
  | "os.update"
  | "report.view"
  | "audit.view"
  | "users.manage"
  | "reference.manage"
  | "settings.manage"
  | "import.run";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "asset.view", "asset.create", "asset.edit", "asset.delete", "staff.manage",
    "movement.record", "movement.request", "request.review",
    "repair.manage", "repair.request", "damage.report", "verify", "os.update",
    "report.view", "audit.view", "users.manage", "reference.manage", "settings.manage", "import.run",
  ],
  INVENTORY_OFFICER: [
    "asset.view", "asset.create", "asset.edit", "staff.manage",
    "movement.record", "movement.request", "request.review",
    "repair.manage", "repair.request", "damage.report", "verify", "os.update",
    "report.view", "audit.view",
  ],
  OPERATIONS_USER: ["asset.view", "movement.request", "repair.request", "damage.report", "report.view"],
  VIEWER: ["asset.view", "report.view"],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role];
}
