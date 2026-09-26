import type { Prisma } from "@prisma/client";
import type { VerificationState } from "@/lib/constants";
import { verificationWhere } from "@/lib/verification-state";

/**
 * One definition of the asset filters, shared by the Assets table, dashboard
 * alert links, reports and exports — so an export always matches what is on screen.
 */
export type AssetFilters = {
  q?: string;
  type?: string[]; // asset type ids
  status?: string[]; // status ids
  statusCode?: string[]; // status codes (used by dashboard links)
  location?: string[]; // location ids, or "none"
  condition?: string[];
  verification?: VerificationState[];
  review?: boolean;
  archived?: boolean;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

type SP = Record<string, string | string[] | undefined> | URLSearchParams;

function getAll(sp: SP, key: string): string[] {
  let raw: string[] = [];
  if (sp instanceof URLSearchParams) raw = sp.getAll(key);
  else {
    const v = sp[key];
    raw = v === undefined ? [] : Array.isArray(v) ? v : [v];
  }
  return raw.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
}

export function parseAssetFilters(sp: SP): AssetFilters {
  const one = (k: string) => getAll(sp, k)[0];
  const verification = getAll(sp, "verification").filter((v): v is VerificationState =>
    ["VERIFIED", "DUE_SOON", "OVERDUE"].includes(v),
  );
  return {
    q: one("q"),
    type: getAll(sp, "type"),
    status: getAll(sp, "status"),
    statusCode: getAll(sp, "statusCode"),
    location: getAll(sp, "location"),
    condition: getAll(sp, "condition"),
    verification,
    review: one("review") === "1",
    archived: one("archived") === "1",
    sort: one("sort"),
    dir: one("dir") === "desc" ? "desc" : "asc",
    page: Math.max(1, Number(one("page")) || 1),
    pageSize: Math.min(500, Math.max(10, Number(one("pageSize")) || 25)),
  };
}

export function filtersToQuery(f: AssetFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const k of ["type", "status", "statusCode", "location", "condition", "verification"] as const) {
    const v = f[k];
    if (v && v.length) p.set(k, v.join(","));
  }
  if (f.review) p.set("review", "1");
  if (f.archived) p.set("archived", "1");
  if (f.sort) p.set("sort", f.sort);
  if (f.dir === "desc") p.set("dir", "desc");
  return p.toString();
}

/** Text search across every identifier the register holds. */
export function assetSearchWhere(q: string): Prisma.AssetWhereInput {
  const term = q.trim();
  const c = { contains: term, mode: "insensitive" as const };
  const compact = term.replace(/\s+/g, "");
  const or: Prisma.AssetWhereInput[] = [
    { assetId: c },
    { deviceName: c },
    { serialNumber: c },
    { imei: c },
    { inventoryNumber: c },
    { assetNumber: c },
    { alternateReference: c },
    { simNumber: c },
    { assignedTo: c },
    { department: c },
    { shift: c },
    { remarks: c },
    { brand: c },
    { model: c },
    { location: { name: c } },
    { staff: { employeeNumber: c } },
    { staff: { name: c } },
  ];
  if (compact !== term) {
    or.push({ imei: { contains: compact } }, { serialNumber: { contains: compact, mode: "insensitive" } });
  }
  return { OR: or };
}

export function buildAssetWhere(f: AssetFilters, today: Date, dueSoonDays: number): Prisma.AssetWhereInput {
  const and: Prisma.AssetWhereInput[] = [{ archived: f.archived ? true : false }];
  if (f.q) and.push(assetSearchWhere(f.q));
  if (f.type?.length) and.push({ assetTypeId: { in: f.type } });
  if (f.status?.length) and.push({ statusId: { in: f.status } });
  if (f.statusCode?.length) and.push({ status: { code: { in: f.statusCode as never[] } } });
  if (f.location?.length) {
    const ids = f.location.filter((l) => l !== "none");
    const or: Prisma.AssetWhereInput[] = [];
    if (ids.length) or.push({ locationId: { in: ids } });
    if (f.location.includes("none")) or.push({ locationId: null });
    and.push({ OR: or });
  }
  if (f.condition?.length) {
    const vals = f.condition.filter((c) => c !== "none");
    const or: Prisma.AssetWhereInput[] = [];
    if (vals.length) or.push({ condition: { in: vals } });
    if (f.condition.includes("none")) or.push({ condition: null });
    and.push({ OR: or });
  }
  if (f.verification?.length) {
    and.push({ OR: f.verification.map((v) => verificationWhere(v, today, dueSoonDays)) });
    and.push({ status: { code: { notIn: ["DISPOSED"] } } });
  }
  if (f.review) and.push({ needsReview: true });
  return { AND: and };
}

const SORTABLE: Record<string, (dir: "asc" | "desc") => Prisma.AssetOrderByWithRelationInput> = {
  assetId: (dir) => ({ assetId: dir }),
  type: (dir) => ({ assetType: { sortOrder: dir } }),
  deviceName: (dir) => ({ deviceName: dir }),
  location: (dir) => ({ location: { name: dir } }),
  assignedTo: (dir) => ({ assignedTo: dir }),
  status: (dir) => ({ status: { sortOrder: dir } }),
  condition: (dir) => ({ condition: dir }),
  lastVerificationDate: (dir) => ({ lastVerificationDate: { sort: dir, nulls: "first" } }),
  nextVerificationDate: (dir) => ({ nextVerificationDate: { sort: dir, nulls: "first" } }),
  lastOsUpdate: (dir) => ({ lastOsUpdate: { sort: dir, nulls: "last" } }),
  updatedAt: (dir) => ({ updatedAt: dir }),
  inventoryNumber: (dir) => ({ inventoryNumber: dir }),
};

export function buildAssetOrderBy(f: AssetFilters): Prisma.AssetOrderByWithRelationInput[] {
  const s = f.sort && SORTABLE[f.sort];
  if (s) return [s(f.dir ?? "asc"), { assetId: "asc" }];
  // Default: by type order, then natural asset id
  return [{ assetType: { sortOrder: "asc" } }, { assetId: "asc" }];
}
