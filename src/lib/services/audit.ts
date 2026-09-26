import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/utils";

/** Human-readable snapshot of an asset used for field-level audit diffs. */
export type AssetSnapshot = Record<string, string | null>;

export const AUDITED_FIELDS: { key: string; label: string }[] = [
  { key: "assetType", label: "asset type" },
  { key: "deviceName", label: "device name" },
  { key: "brand", label: "brand" },
  { key: "model", label: "model" },
  { key: "serialNumber", label: "serial number" },
  { key: "imei", label: "IMEI" },
  { key: "inventoryNumber", label: "inventory number" },
  { key: "assetNumber", label: "asset number" },
  { key: "alternateReference", label: "alt. reference" },
  { key: "simOperator", label: "SIM operator" },
  { key: "simNumber", label: "SIM number" },
  { key: "location", label: "location" },
  { key: "assignedTo", label: "assignment" },
  { key: "department", label: "department" },
  { key: "shift", label: "shift" },
  { key: "status", label: "status" },
  { key: "condition", label: "condition" },
  { key: "receivedDate", label: "received date" },
  { key: "issuedDate", label: "issued date" },
  { key: "lastServiceDate", label: "last service date" },
  { key: "lastVerificationDate", label: "last verification" },
  { key: "nextVerificationDate", label: "next verification" },
  { key: "lastOsUpdate", label: "last OS update" },
  { key: "osVersion", label: "OS version" },
  { key: "remarks", label: "remarks" },
  { key: "attributes", label: "type-specific fields" },
  { key: "archived", label: "archived" },
];

type AssetForSnapshot = Prisma.AssetGetPayload<{ include: { location: true; status: true; assetType: true } }>;

export function snapshotAsset(a: AssetForSnapshot): AssetSnapshot {
  const d = (v: Date | null) => (v ? formatDate(v) : null);
  return {
    assetType: a.assetType.name,
    deviceName: a.deviceName,
    brand: a.brand,
    model: a.model,
    serialNumber: a.serialNumber,
    imei: a.imei,
    inventoryNumber: a.inventoryNumber,
    assetNumber: a.assetNumber,
    alternateReference: a.alternateReference,
    simOperator: a.simOperator,
    simNumber: a.simNumber,
    location: a.location?.name ?? null,
    assignedTo: a.assignedTo,
    department: a.department,
    shift: a.shift,
    status: a.status.name,
    condition: a.condition,
    receivedDate: d(a.receivedDate),
    issuedDate: d(a.issuedDate),
    lastServiceDate: d(a.lastServiceDate),
    lastVerificationDate: d(a.lastVerificationDate),
    nextVerificationDate: d(a.nextVerificationDate),
    lastOsUpdate: d(a.lastOsUpdate),
    osVersion: a.osVersion,
    remarks: a.remarks,
    attributes: JSON.stringify(a.attributes ?? {}),
    archived: a.archived ? "Yes" : "No",
  };
}

function describe(code: string, field: string, label: string, oldV: string | null, newV: string | null) {
  if (field === "assignedTo") {
    if (!newV) return `Asset ${code} unassigned from ${oldV}`;
    if (!oldV) return `Asset ${code} assigned to ${newV}`;
    return `Asset ${code} reassigned from ${oldV} to ${newV}`;
  }
  if (!oldV) return `Asset ${code} ${label} set to ${newV}`;
  if (!newV) return `Asset ${code} ${label} cleared (was ${oldV})`;
  return `Asset ${code} ${label} changed from ${oldV} to ${newV}`;
}

/** Write one audit row per changed field. */
export async function auditAssetDiff(
  tx: Tx,
  user: CurrentUser | null,
  asset: { id: string; assetId: string },
  before: AssetSnapshot,
  after: AssetSnapshot,
  action: string,
) {
  const rows: Prisma.AuditLogCreateManyInput[] = [];
  for (const { key, label } of AUDITED_FIELDS) {
    const o = before[key] ?? null;
    const n = after[key] ?? null;
    if ((o || null) === (n || null)) continue;
    rows.push({
      userId: user?.id,
      userName: user?.name ?? "System",
      assetId: asset.id,
      assetCode: asset.assetId,
      entityType: "Asset",
      entityId: asset.id,
      action,
      field: key,
      oldValue: o,
      newValue: n,
      message: describe(asset.assetId, key, label, o, n),
    });
  }
  if (rows.length) await tx.auditLog.createMany({ data: rows });
  return rows.length;
}

/** Log a non-field event (login, user created, settings changed, import…). */
export async function auditEvent(
  db: Tx | typeof prisma,
  user: CurrentUser | null,
  e: { entityType: string; entityId?: string | null; action: string; message: string; asset?: { id: string; assetId: string } | null; oldValue?: string | null; newValue?: string | null },
) {
  await db.auditLog.create({
    data: {
      userId: user?.id,
      userName: user?.name ?? "System",
      assetId: e.asset?.id,
      assetCode: e.asset?.assetId,
      entityType: e.entityType,
      entityId: e.entityId ?? e.asset?.id ?? null,
      action: e.action,
      message: e.message,
      oldValue: e.oldValue ?? null,
      newValue: e.newValue ?? null,
    },
  });
}
