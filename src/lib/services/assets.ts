import type { Prisma, StatusCode } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/action";
import type { AssetInput } from "@/lib/validation/schemas";
import { addDays, parseISODate, todayDate } from "@/lib/utils";
import { getSettings } from "./settings";
import { auditAssetDiff, auditEvent, snapshotAsset } from "./audit";
import { buildAssetOrderBy, buildAssetWhere, type AssetFilters } from "@/lib/asset-filters";
import { verificationState } from "@/lib/verification-state";

export const ASSET_INCLUDE = {
  assetType: true,
  location: true,
  status: true,
  staff: { select: { id: true, name: true, employeeNumber: true, designation: true, shift: true } },
} satisfies Prisma.AssetInclude;

export type AssetWithRefs = Prisma.AssetGetPayload<{ include: typeof ASSET_INCLUDE }>;

// ── Reading ────────────────────────────────────────────────────

export async function listAssets(filters: AssetFilters, opts: { all?: boolean } = {}) {
  const settings = await getSettings();
  const today = todayDate();
  const where = buildAssetWhere(filters, today, settings.dueSoonDays);
  const pageSize = filters.pageSize ?? 25;
  const page = filters.page ?? 1;
  const [total, rows] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      include: ASSET_INCLUDE,
      orderBy: buildAssetOrderBy(filters),
      ...(opts.all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    rows: rows.map((a) => ({ ...a, verification: verificationState(a.nextVerificationDate, today, settings.dueSoonDays) })),
    settings,
  };
}

export async function getAssetByCode(assetCode: string) {
  return prisma.asset.findUnique({ where: { assetId: assetCode }, include: ASSET_INCLUDE });
}

export async function getAssetDetail(assetCode: string) {
  const asset = await prisma.asset.findUnique({
    where: { assetId: assetCode },
    include: {
      ...ASSET_INCLUDE,
      movements: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { recordedBy: { select: { name: true } } } },
      repairs: { orderBy: [{ repairOutDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] },
      verifications: { orderBy: [{ verificationDate: "desc" }, { createdAt: "desc" }] },
      damageReports: { orderBy: { date: "desc" }, include: { attachments: { select: { id: true, fileName: true, mimeType: true } } } },
      osUpdates: { orderBy: { updateDate: "desc" } },
      attachments: { where: { damageReportId: null }, select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!asset) return null;
  const settings = await getSettings();
  return { asset, verification: verificationState(asset.nextVerificationDate, todayDate(), settings.dueSoonDays), settings };
}

/** Compact info shown in movement forms after selecting an asset. */
export async function lookupAsset(idOrCode: string) {
  const a = await prisma.asset.findFirst({
    where: { OR: [{ id: idOrCode }, { assetId: idOrCode }] },
    include: {
      ...ASSET_INCLUDE,
      repairs: { where: { status: "OPEN" }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!a) return null;
  return {
    id: a.id,
    assetId: a.assetId,
    deviceName: a.deviceName,
    assetType: a.assetType.name,
    locationId: a.locationId,
    location: a.location?.name ?? null,
    status: a.status.name,
    statusCode: a.status.code,
    statusColor: a.status.color,
    assignedTo: a.assignedTo,
    staff: a.staff,
    shift: a.shift,
    department: a.department,
    condition: a.condition,
    serial: a.imei || a.serialNumber,
    assetNumber: a.assetNumber,
    inventoryNumber: a.inventoryNumber,
    openRepair: a.repairs[0]
      ? { id: a.repairs[0].id, problem: a.repairs[0].reportedProblem, since: a.repairs[0].repairOutDate?.toISOString() ?? null, technician: a.repairs[0].technician }
      : null,
  };
}
export type AssetLookup = NonNullable<Awaited<ReturnType<typeof lookupAsset>>>;

/** Lightweight option list for asset pickers. */
export async function searchAssetOptions(q: string, limit = 20) {
  const term = q.trim();
  const where: Prisma.AssetWhereInput = term
    ? {
        archived: false,
        OR: [
          { assetId: { contains: term, mode: "insensitive" } },
          { deviceName: { contains: term, mode: "insensitive" } },
          { imei: { contains: term } },
          { serialNumber: { contains: term, mode: "insensitive" } },
          { inventoryNumber: { contains: term, mode: "insensitive" } },
          { assetNumber: { contains: term, mode: "insensitive" } },
        ],
      }
    : { archived: false };
  const rows = await prisma.asset.findMany({
    where,
    take: limit,
    orderBy: { assetId: "asc" },
    select: { id: true, assetId: true, deviceName: true, assetType: { select: { name: true } }, status: { select: { name: true, color: true } }, location: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    assetId: r.assetId,
    deviceName: r.deviceName,
    type: r.assetType.name,
    status: r.status.name,
    statusColor: r.status.color,
    location: r.location?.name ?? null,
  }));
}

// ── Asset ID generation ───────────────────────────────────────

export async function nextAssetId(assetTypeId: string, db: Tx | typeof prisma = prisma): Promise<string> {
  const type = await db.assetType.findUnique({ where: { id: assetTypeId } });
  if (!type) throw new DomainError("Unknown asset type");
  const prefix = `${type.prefix}-`;
  const existing = await db.asset.findMany({ where: { assetId: { startsWith: prefix } }, select: { assetId: true } });
  let max = 0;
  for (const { assetId } of existing) {
    const n = Number(assetId.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// ── Validation helpers ────────────────────────────────────────

const UNIQUE_FIELDS = [
  { key: "serialNumber", label: "Serial number" },
  { key: "imei", label: "IMEI" },
  { key: "inventoryNumber", label: "Inventory number" },
  { key: "assetNumber", label: "Asset number" },
] as const;

/**
 * Serial/IMEI, inventory and asset numbers must be unique where present.
 * Only values that are new or changed are checked, so legacy duplicates flagged
 * at import don't block unrelated edits.
 */
async function assertUniqueIdentifiers(db: Tx, input: Partial<AssetInput>, existing?: AssetWithRefs | null) {
  const fieldErrors: Record<string, string> = {};
  for (const { key, label } of UNIQUE_FIELDS) {
    const v = input[key];
    if (!v) continue;
    if (existing && (existing[key] ?? "").toLowerCase() === v.toLowerCase()) continue;
    const clash = await db.asset.findFirst({
      where: { [key]: { equals: v, mode: "insensitive" }, archived: false, ...(existing ? { id: { not: existing.id } } : {}) },
      select: { assetId: true },
    });
    if (clash) fieldErrors[key] = `${label} already used by ${clash.assetId}`;
  }
  if (Object.keys(fieldErrors).length) throw new DomainError("Duplicate identifiers found.", fieldErrors);
}

async function requireStatus(db: Tx, statusId: string) {
  const s = await db.status.findUnique({ where: { id: statusId } });
  if (!s) throw new DomainError("Unknown status");
  return s;
}

export async function statusByCode(db: Tx | typeof prisma, code: StatusCode) {
  const s = await db.status.findFirst({ where: { code }, orderBy: { sortOrder: "asc" } });
  if (!s) throw new DomainError(`No status configured for ${code}. Check Settings → Statuses.`);
  return s;
}

function inputToData(input: AssetInput) {
  return {
    assetTypeId: input.assetTypeId,
    deviceName: input.deviceName,
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    imei: input.imei,
    inventoryNumber: input.inventoryNumber,
    assetNumber: input.assetNumber,
    alternateReference: input.alternateReference,
    simOperator: input.simOperator,
    simNumber: input.simNumber,
    locationId: input.locationId,
    assignedTo: input.assignedTo,
    shift: input.shift,
    department: input.department,
    statusId: input.statusId,
    condition: input.condition,
    lastOsUpdate: parseISODate(input.lastOsUpdate),
    osVersion: input.osVersion,
    lastServiceDate: parseISODate(input.lastServiceDate),
    nextVerificationDate: parseISODate(input.nextVerificationDate),
    receivedDate: parseISODate(input.receivedDate),
    remarks: input.remarks,
    attributes: input.attributes ?? {},
  };
}

// ── Writing ───────────────────────────────────────────────────

/**
 * The single place that mutates an asset's current state.
 * Every caller (edit, movements, repairs, verification…) goes through here so the
 * audit trail is always written in the same transaction.
 */
export async function applyAssetChange(
  tx: Tx,
  user: CurrentUser | null,
  assetDbId: string,
  data: Prisma.AssetUncheckedUpdateInput,
  action: string,
) {
  const before = await tx.asset.findUniqueOrThrow({ where: { id: assetDbId }, include: ASSET_INCLUDE });
  const after = await tx.asset.update({ where: { id: assetDbId }, data, include: ASSET_INCLUDE });
  await auditAssetDiff(tx, user, after, snapshotAsset(before), snapshotAsset(after), action);
  return { before, after };
}

export async function createAsset(input: AssetInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    await requireStatus(tx, input.statusId);
    await assertUniqueIdentifiers(tx, input);
    const assetId = await nextAssetId(input.assetTypeId, tx);
    const data = inputToData(input);
    const asset = await tx.asset.create({ data: { ...data, assetId, source: "APP" }, include: ASSET_INCLUDE });
    await tx.movement.create({
      data: {
        assetId: asset.id,
        action: "REGISTERED",
        date: data.receivedDate ?? todayDate(),
        toLocation: asset.location?.name,
        assignedTo: asset.assignedTo,
        statusAfter: asset.status.name,
        doneBy: user.name,
        recordedById: user.id,
        notes: "Asset registered",
      },
    });
    await auditEvent(tx, user, {
      entityType: "Asset",
      action: "CREATE",
      asset,
      message: `Asset ${asset.assetId} (${asset.assetType.name}${asset.deviceName ? ` · ${asset.deviceName}` : ""}) registered`,
      newValue: asset.assetId,
    });
    return asset;
  });
}

export async function updateAsset(id: string, input: AssetInput, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({ where: { id }, include: ASSET_INCLUDE });
    if (!existing) throw new DomainError("Asset not found");
    await requireStatus(tx, input.statusId);
    await assertUniqueIdentifiers(tx, input, existing);
    const data = inputToData(input);
    // Editing the free-text assignee detaches the staff link (issue/transfer set it properly)
    const staffPatch = (input.assignedTo ?? null) !== (existing.assignedTo ?? null) ? { staffId: null } : {};
    if (existing.assetTypeId !== input.assetTypeId) {
      throw new DomainError("Asset type cannot be changed after registration (the Asset ID prefix depends on it).");
    }
    const { after } = await applyAssetChange(tx, user, id, { ...data, ...staffPatch }, "UPDATE");
    return after;
  });
}

/** Mark the review flag resolved (for migrated records). */
export async function resolveReview(id: string, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.asset.update({ where: { id }, data: { needsReview: false } });
    await auditEvent(tx, user, { entityType: "Asset", action: "REVIEW_RESOLVED", asset: a, message: `Asset ${a.assetId} import review marked as resolved`, oldValue: a.reviewNotes });
    return a;
  });
}

/**
 * Administrators can delete an asset. Deletion is a soft delete (archive) so the
 * movement log and audit trail — which must never be lost — remain intact.
 * Archived assets can be viewed and restored from the Assets page.
 */
export async function deleteAsset(id: string, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.asset.findUnique({ where: { id } });
    if (!a) throw new DomainError("Asset not found");
    await applyAssetChange(tx, user, id, { archived: true }, "ARCHIVE");
    await auditEvent(tx, user, { entityType: "Asset", action: "DELETE", asset: a, message: `Asset ${a.assetId} deleted (archived; history retained)` });
    return { archived: true };
  });
}

export async function restoreAsset(id: string, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const { after } = await applyAssetChange(tx, user, id, { archived: false }, "RESTORE");
    return after;
  });
}

/** Compute next verification date from a verification date and the configured interval. */
export async function nextVerificationFrom(date: Date, db: Tx | typeof prisma = prisma) {
  const s = await getSettings(db);
  return addDays(date, s.verificationIntervalDays);
}
