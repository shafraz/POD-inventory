/** Helpers that turn messy spreadsheet cells into clean values — conservatively. */

export function cellValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if ("formula" in o || "sharedFormula" in o) return null;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in o) return cellValue(o.text);
    if ("error" in o) return null;
    return null;
  }
  return v;
}

/** Trimmed string, with non-breaking spaces and blank-looking cells treated as empty. */
export function str(v: unknown): string | null {
  const c = cellValue(v);
  if (c === null) return null;
  if (c instanceof Date) return isoDate(c);
  if (typeof c === "number") return Number.isInteger(c) ? String(c) : String(c);
  const s = String(c).replace(/ /g, " ").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export function isoDate(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

/** Dates may be real Excel dates or text such as "31.1.2022", "25.4.2026", "31.05.25". */
export function parseDateCell(v: unknown): string | null {
  const c = cellValue(v);
  if (c instanceof Date) return isNaN(c.getTime()) ? null : isoDate(c);
  const s = str(c);
  if (!s) return null;
  return findDateInText(s, true);
}

export function findDateInText(s: string, whole = false): string | null {
  const re = whole ? /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/ : /(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/;
  const m = re.exec(s.trim());
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const mo = Number(m[2]);
  const d = Number(m[1]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10);
}

/** Collapse "MPL-CGO-OEQ-VHFS- 00718" → "MPL-CGO-OEQ-VHFS-00718". */
export function normalizeCode(s: string | null): string | null {
  if (!s) return s;
  return s.replace(/-\s+/g, "-").replace(/\s+-/g, "-").trim();
}

/** Identifier comparison key: upper-case, no spaces. */
export function idKey(s: string | null | undefined): string | null {
  if (!s) return null;
  const k = s.replace(/\s+/g, "").toUpperCase();
  return k || null;
}

export function looksLikeImei(s: string | null): boolean {
  return !!s && /^\d{14,16}$/.test(s.replace(/\s+/g, ""));
}

/** Known safe spelling corrections for brands (original value is always preserved in legacy_data). */
const BRAND_FIXES: Record<string, string> = {
  MOTROLA: "Motorola",
  MOTOROLA: "Motorola",
  "VERTEX STANDARD": "Vertex Standard",
  "VHF SETS (MOTROLA - XIR P3688": "Motorola",
};

export function normalizeBrand(raw: string | null, known: string[]): { value: string | null; changed: boolean } {
  if (!raw) return { value: null, changed: false };
  const up = raw.toUpperCase().trim();
  const fixed = BRAND_FIXES[up];
  if (fixed) return { value: fixed, changed: fixed !== raw };
  const k = known.find((b) => b.toUpperCase() === up);
  if (k) return { value: k, changed: k !== raw };
  return { value: raw, changed: false };
}

/** "Dhiraagu 10GB / 1675 4957" → operator + number. */
export function splitSim(raw: string | null): { operator: string | null; number: string | null } {
  if (!raw) return { operator: null, number: null };
  const [op, num] = raw.split("/").map((s) => s.trim());
  const operator = op && op.toLowerCase() !== "none" ? op : null;
  return { operator, number: num || null };
}

export type LocationIndex = Map<string, string>; // lower-case name/alias → canonical name

export function buildLocationIndex(locs: { name: string; aliases: string[] }[]): LocationIndex {
  const idx: LocationIndex = new Map();
  for (const l of locs) {
    idx.set(l.name.toLowerCase(), l.name);
    for (const a of l.aliases) idx.set(a.toLowerCase(), l.name);
  }
  return idx;
}

export function resolveLocation(raw: string | null, idx: LocationIndex): { name: string | null; status: "ok" | "normalized" | "unknown" | "missing" } {
  if (!raw) return { name: null, status: "missing" };
  const exact = idx.get(raw.toLowerCase());
  if (exact) return { name: exact, status: exact === raw ? "ok" : "normalized" };
  const squashed = raw.toLowerCase().replace(/[\s._-]+/g, "");
  for (const [k, v] of idx) {
    if (k.replace(/[\s._-]+/g, "") === squashed) return { name: v, status: "normalized" };
  }
  return { name: raw, status: "unknown" };
}

/** Header text → comparable key. */
export function headerKey(v: unknown): string {
  return (str(v) ?? "").toLowerCase().replace(/[^a-z0-9/]+/g, " ").trim();
}
