import { prisma } from "@/lib/db";
import { addDays, todayDate } from "@/lib/utils";
import { getSettings } from "./settings";
import { VERIFIABLE_WHERE, verificationDueWhere } from "@/lib/verification-state";

/**
 * Every number on the dashboard is computed live from the database.
 * Nothing is stored — any change to an asset is reflected on the next load.
 */
export async function getDashboardData() {
  const settings = await getSettings();
  const today = todayDate();
  const soon = addDays(today, settings.dueSoonDays);
  const active = { archived: false };

  const [types, statuses, locations, byTypeStatus, byTypeLocation, verifOverdue, verifDueSoon, verifOk, verifDue, openRepairs, recent, needsReview, pendingRequests] =
    await Promise.all([
      prisma.assetType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
      prisma.status.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.location.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.asset.groupBy({ by: ["assetTypeId", "statusId"], where: active, _count: { _all: true } }),
      prisma.asset.groupBy({ by: ["assetTypeId", "locationId"], where: { ...active, status: { code: { notIn: ["DISPOSED"] } } }, _count: { _all: true } }),
      prisma.asset.count({ where: { ...VERIFIABLE_WHERE, OR: [{ nextVerificationDate: null }, { nextVerificationDate: { lt: today } }] } }),
      prisma.asset.count({ where: { ...VERIFIABLE_WHERE, nextVerificationDate: { gte: today, lte: soon } } }),
      prisma.asset.count({ where: { ...VERIFIABLE_WHERE, nextVerificationDate: { gt: soon } } }),
      prisma.asset.count({ where: { ...VERIFIABLE_WHERE, ...verificationDueWhere(today) } }),
      prisma.repair.count({ where: { status: "OPEN" } }),
      prisma.movement.findMany({
        where: { action: { notIn: ["REGISTERED"] } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 10,
        include: { asset: { select: { assetId: true, deviceName: true, assetType: { select: { name: true } } } }, recordedBy: { select: { name: true } } },
      }),
      prisma.asset.count({ where: { ...active, needsReview: true } }),
      prisma.assetRequest.count({ where: { status: "PENDING" } }),
    ]);

  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const countByCode = (code: string) =>
    byTypeStatus.filter((r) => statusById.get(r.statusId)?.code === code).reduce((n, r) => n + r._count._all, 0);
  const disposed = countByCode("DISPOSED");
  const all = byTypeStatus.reduce((n, r) => n + r._count._all, 0);

  const kpis = {
    total: all - disposed,
    inUse: countByCode("IN_USE"),
    inStock: countByCode("IN_STOCK"),
    underRepair: countByCode("UNDER_REPAIR"),
    damaged: countByCode("DAMAGED"),
    unverified: countByCode("UNVERIFIED"),
    lost: countByCode("LOST"),
    verificationDue: verifDue,
  };

  const typeOverview = types.map((t) => {
    const rows = byTypeStatus.filter((r) => r.assetTypeId === t.id);
    const by = (code: string) => rows.filter((r) => statusById.get(r.statusId)?.code === code).reduce((n, r) => n + r._count._all, 0);
    const total = rows.reduce((n, r) => n + r._count._all, 0) - by("DISPOSED");
    return {
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      total,
      inUse: by("IN_USE"),
      inStock: by("IN_STOCK"),
      underRepair: by("UNDER_REPAIR"),
      damaged: by("DAMAGED"),
      unverified: by("UNVERIFIED"),
      other: total - by("IN_USE") - by("IN_STOCK") - by("UNDER_REPAIR") - by("DAMAGED") - by("UNVERIFIED"),
    };
  });

  const statusChart = statuses
    .map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      color: s.color,
      value: byTypeStatus.filter((r) => r.statusId === s.id).reduce((n, r) => n + r._count._all, 0),
    }));

  const locIndex = new Map(locations.map((l) => [l.id, l.name]));
  const locMap = new Map<string, { id: string; name: string; total: number; byType: Record<string, number> }>();
  for (const r of byTypeLocation) {
    const key = r.locationId ?? "none";
    const name = r.locationId ? locIndex.get(r.locationId) ?? "?" : "No location";
    const entry = locMap.get(key) ?? { id: key, name, total: 0, byType: {} };
    entry.total += r._count._all;
    const typeName = types.find((t) => t.id === r.assetTypeId)?.name ?? "Other";
    entry.byType[typeName] = (entry.byType[typeName] ?? 0) + r._count._all;
    locMap.set(key, entry);
  }
  const locationChart = [...locMap.values()].sort((a, b) => (a.id === "none" ? 1 : b.id === "none" ? -1 : b.total - a.total));

  return {
    settings,
    kpis,
    typeOverview,
    statusChart,
    locationChart,
    typeNames: types.map((t) => t.name),
    verification: { verified: verifOk, dueSoon: verifDueSoon, overdue: verifOverdue },
    openRepairs,
    needsReview,
    pendingRequests,
    statusIdByCode: Object.fromEntries(statuses.map((s) => [s.code, s.id])),
    recent: recent.map((m) => ({
      id: m.id,
      date: m.date.toISOString(),
      assetId: m.asset.assetId,
      device: m.asset.deviceName,
      type: m.asset.assetType.name,
      action: m.action,
      from: m.fromLocation,
      to: m.toLocation,
      assignedTo: m.assignedTo,
      doneBy: m.doneBy ?? m.recordedBy?.name ?? null,
    })),
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
