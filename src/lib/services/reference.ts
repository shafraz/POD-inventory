import type { LookupCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseTypeConfig, type AssetTypeConfig } from "@/lib/asset-type-config";

/** Everything the forms need for dropdowns — all from the database, nothing hard-coded. */
export async function getReferenceData(opts: { includeInactive?: boolean } = {}) {
  const active = opts.includeInactive ? {} : { active: true };
  const [types, locations, statuses, lookups] = await Promise.all([
    prisma.assetType.findMany({ where: active, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.location.findMany({ where: active, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.status.findMany({ where: active, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.lookupValue.findMany({ where: active, orderBy: [{ sortOrder: "asc" }, { value: "asc" }] }),
  ]);
  const byCat = (c: LookupCategory) => lookups.filter((l) => l.category === c).map((l) => l.value);
  return {
    types: types.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, active: t.active, config: parseTypeConfig(t.config) as AssetTypeConfig })),
    locations: locations.map((l) => ({ id: l.id, name: l.name, active: l.active })),
    statuses: statuses.map((s) => ({ id: s.id, name: s.name, code: s.code, color: s.color, active: s.active })),
    conditions: byCat("CONDITION"),
    departments: byCat("DEPARTMENT"),
    shifts: byCat("SHIFT"),
    simOperators: byCat("SIM_OPERATOR"),
    brands: byCat("BRAND"),
  };
}
export type ReferenceData = Awaited<ReturnType<typeof getReferenceData>>;
