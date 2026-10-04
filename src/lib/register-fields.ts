/**
 * Canonical values for the Asset Register layout.
 * Location and Assigned To use a fixed list plus "Others"; anything that
 * doesn't fit is kept in the matching *Remark field so no information is lost.
 */

export const OTHERS = "Others";

export const DEFAULT_LOCATIONS = ["MCH", "THT", "HMT", OTHERS] as const;
export const DEFAULT_ASSIGNED_UNITS = ["Tally", "Forman", "Grd IC", "Duty IC", "Yard office", "Ops Office", "Gear Store", "Admin", "Digital unit", OTHERS] as const;
export const DEFAULT_SHIFTS = ["A", "B", "C", "All morning"] as const;
export const DEFAULT_STATUSES = ["In use", "In stock", "Under Repair", "Damaged", "Unverified", "Not in use", "Disposed", "Lost"] as const;

export const isOthers = (v: string | null | undefined) => !!v && v.trim().toLowerCase() === "others";

const LOCATION_MAP: Record<string, string> = {
  mch: "MCH", "pod-mch": "MCH", "pod mch": "MCH",
  tht: "THT", thilafushi: "THT",
  hmt: "HMT", "pod-hmt": "HMT", "pod hmt": "HMT",
  others: OTHERS, other: OTHERS,
};

/** Map a free-text location (e.g. from Excel) onto the location list. */
export function canonicalLocation(raw: string | null | undefined): { name: string | null; remark: string | null } {
  const v = raw?.trim();
  if (!v) return { name: null, remark: null };
  const key = v.toLowerCase();
  const hit = LOCATION_MAP[key];
  if (!hit) return { name: OTHERS, remark: v };
  const keepRemark = key !== hit.toLowerCase() && key !== "thilafushi" && hit !== OTHERS;
  return { name: hit, remark: keepRemark ? v : null };
}

/** Map a free-text "assigned to" onto the unit list. */
export function canonicalAssignedTo(raw: string | null | undefined): { value: string | null; remark: string | null } {
  const v = raw?.trim();
  if (!v) return { value: null, remark: null };
  const exact = DEFAULT_ASSIGNED_UNITS.find((u) => u.toLowerCase() === v.toLowerCase());
  if (exact) return { value: exact, remark: null };
  if (/tall(y|ies)/i.test(v)) return { value: "Tally", remark: v };
  if (/^gear/i.test(v)) return { value: "Gear Store", remark: v };
  return { value: OTHERS, remark: v };
}

const SHIFT_MAP: Record<string, string> = { "a shift": "A", "b shift": "B", "c shift": "C", general: "All morning", a: "A", b: "B", c: "C", "all morning": "All morning" };
export function canonicalShift(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  return SHIFT_MAP[v.toLowerCase()] ?? v;
}

/** "Others – COD", "MCH (POD-MCH)" or just "MCH" — used in history and exports. */
export function withRemark(value: string | null | undefined, remark: string | null | undefined): string | null {
  if (!value) return remark?.trim() || null;
  if (!remark?.trim()) return value;
  return isOthers(value) ? `${value} – ${remark.trim()}` : `${value} (${remark.trim()})`;
}
