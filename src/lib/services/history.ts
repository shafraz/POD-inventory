import type { MovementAction, Prisma, RepairStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseISODate } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;
const first = (sp: SP, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
};

// ── Movements ─────────────────────────────────────────────────

export type MovementFilters = {
  from?: string;
  to?: string;
  asset?: string;
  action?: string;
  location?: string;
  user?: string;
  page: number;
  pageSize: number;
};

export function parseMovementFilters(sp: SP): MovementFilters {
  return {
    from: first(sp, "from"),
    to: first(sp, "to"),
    asset: first(sp, "asset"),
    action: first(sp, "action"),
    location: first(sp, "location"),
    user: first(sp, "user"),
    page: Math.max(1, Number(first(sp, "page")) || 1),
    pageSize: Math.min(500, Number(first(sp, "pageSize")) || 25),
  };
}

export function movementWhere(f: MovementFilters): Prisma.MovementWhereInput {
  const and: Prisma.MovementWhereInput[] = [];
  const from = parseISODate(f.from);
  const to = parseISODate(f.to);
  if (from || to) and.push({ date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  if (f.asset) {
    and.push({
      asset: {
        OR: [
          { assetId: { contains: f.asset, mode: "insensitive" } },
          { deviceName: { contains: f.asset, mode: "insensitive" } },
          { imei: { contains: f.asset } },
          { serialNumber: { contains: f.asset, mode: "insensitive" } },
        ],
      },
    });
  }
  if (f.action) and.push({ action: f.action as MovementAction });
  if (f.location) {
    and.push({
      OR: [
        { fromLocation: { equals: f.location, mode: "insensitive" } },
        { toLocation: { equals: f.location, mode: "insensitive" } },
      ],
    });
  }
  if (f.user) {
    const c = { contains: f.user, mode: "insensitive" as const };
    and.push({ OR: [{ doneBy: c }, { assignedTo: c }, { recordedBy: { name: c } }] });
  }
  return and.length ? { AND: and } : {};
}

export async function listMovements(f: MovementFilters, all = false) {
  const where = movementWhere(f);
  const [total, rows] = await Promise.all([
    prisma.movement.count({ where }),
    prisma.movement.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        asset: { select: { assetId: true, deviceName: true, assetType: { select: { name: true } } } },
        recordedBy: { select: { name: true } },
      },
      ...(all ? {} : { skip: (f.page - 1) * f.pageSize, take: f.pageSize }),
    }),
  ]);
  return { total, rows };
}

// ── Repairs & damage ─────────────────────────────────────────

export async function listRepairs(status?: RepairStatus | "ALL", q?: string) {
  const where: Prisma.RepairWhereInput = {};
  if (status && status !== "ALL") where.status = status;
  if (q) {
    where.asset = {
      OR: [
        { assetId: { contains: q, mode: "insensitive" } },
        { deviceName: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  return prisma.repair.findMany({
    where,
    orderBy: [{ status: "asc" }, { repairOutDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { asset: { select: { assetId: true, deviceName: true, assetType: { select: { name: true } }, location: { select: { name: true } } } } },
    take: 500,
  });
}

export async function listDamageReports(q?: string) {
  return prisma.damageReport.findMany({
    where: q ? { asset: { OR: [{ assetId: { contains: q, mode: "insensitive" } }, { deviceName: { contains: q, mode: "insensitive" } }] } } : {},
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      asset: { select: { assetId: true, deviceName: true, assetType: { select: { name: true } }, status: { select: { name: true, color: true } } } },
      attachments: { select: { id: true, fileName: true } },
    },
    take: 500,
  });
}

export async function listRequests(status: "PENDING" | "ALL" = "PENDING", requestedById?: string) {
  return prisma.assetRequest.findMany({
    where: { ...(status === "PENDING" ? { status: "PENDING" } : {}), ...(requestedById ? { requestedById } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      asset: { select: { id: true, assetId: true, deviceName: true, location: { select: { name: true } }, status: { select: { name: true, color: true } } } },
      requestedBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
    take: 200,
  });
}

// ── Audit ────────────────────────────────────────────────────

export type AuditFilters = { q?: string; entity?: string; user?: string; from?: string; to?: string; page: number; pageSize: number };

export function parseAuditFilters(sp: SP): AuditFilters {
  return {
    q: first(sp, "q"),
    entity: first(sp, "entity"),
    user: first(sp, "user"),
    from: first(sp, "from"),
    to: first(sp, "to"),
    page: Math.max(1, Number(first(sp, "page")) || 1),
    pageSize: Math.min(500, Number(first(sp, "pageSize")) || 50),
  };
}

export function auditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.q) {
    const c = { contains: f.q, mode: "insensitive" as const };
    and.push({ OR: [{ message: c }, { assetCode: c }, { action: c }] });
  }
  if (f.entity) and.push({ entityType: f.entity });
  if (f.user) and.push({ userName: { contains: f.user, mode: "insensitive" } });
  const from = parseISODate(f.from);
  const to = parseISODate(f.to);
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lt: new Date(to.getTime() + 86_400_000) } });
  return and.length ? { AND: and } : {};
}

export async function listAudit(f: AuditFilters, all = false) {
  const where = auditWhere(f);
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: all ? 0 : (f.page - 1) * f.pageSize,
      take: all ? 20_000 : f.pageSize,
    }),
  ]);
  return { total, rows };
}
