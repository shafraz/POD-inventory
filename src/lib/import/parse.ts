import ExcelJS from "exceljs";
import { ACTION_LABELS } from "@/lib/constants";
import type { AssetTypeConfig } from "@/lib/asset-type-config";
import {
  buildLocationIndex, cellValue, findDateInText, headerKey, idKey, looksLikeImei, normalizeBrand, normalizeCode,
  parseDateCell, resolveLocation, splitSim, str, type LocationIndex,
} from "./normalize";
import {
  ISSUE_META, type Issue, type IssueCode, type ReferenceAdditions, type StagedAsset, type StagedImport,
  type StagedMovement, type StagedRow,
} from "./types";

export type ImportContext = {
  types: { name: string; prefix: string; config: AssetTypeConfig }[];
  locations: { name: string; aliases: string[] }[];
  statuses: string[];
  brands: string[];
  simOperators: string[];
  existing: { assetId: string; serialNumber: string | null; imei: string | null }[];
};

type Grid = { name: string; rows: unknown[][] }; // rows[i] = 0-based cells for Excel row i+1

function sheetKey(name: string) {
  return name.toLowerCase().replace(/[“”″"']/g, "").replace(/[^a-z0-9]/g, "");
}

async function loadGrids(buffer: ArrayBuffer | Buffer): Promise<Grid[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const grids: Grid[] = [];
  wb.eachSheet((ws) => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellValue(cell.value);
      });
      rows[n - 1] = cells;
    });
    grids.push({ name: ws.name, rows });
  });
  return grids;
}

function findHeaderRow(g: Grid, required: string[], maxScan = 8): number {
  for (let i = 0; i < Math.min(maxScan, g.rows.length); i++) {
    const keys = (g.rows[i] ?? []).map(headerKey);
    if (required.every((r) => keys.includes(r))) return i;
  }
  return -1;
}

function indexOfHeader(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex((h) => h === c);
    if (i >= 0) return i;
  }
  for (const c of candidates) {
    const i = headers.findIndex((h) => h.startsWith(c));
    if (i >= 0) return i;
  }
  return -1;
}

const at = (row: unknown[] | undefined, i: number) => (i >= 0 && row ? row[i] : null);

function labelsOf(row: unknown[] | undefined): string[] {
  return (row ?? []).map((v) => str(v) ?? "");
}

function rawRecord(headers: string[], row: unknown[], from = 0, to = row.length): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = from; i < to; i++) {
    const v = row[i];
    if (v === null || v === undefined || (typeof v === "string" && !v.replace(/ /g, "").trim())) continue;
    const label = headers[i] || `col${i + 1}`;
    out[label] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  return out;
}

function emptyAsset(typeName: string): StagedAsset {
  return {
    assetId: null, typeName, deviceName: null, brand: null, model: null, serialNumber: null, imei: null,
    inventoryNumber: null, assetNumber: null, alternateReference: null, simOperator: null, simNumber: null,
    locationName: null, locationRaw: null, assignedTo: null, shift: null, statusName: "Unverified", condition: null,
    issuedDate: null, receivedDate: null, lastOsUpdate: null, lastVerified: null, remarks: null, attributes: {}, repairs: [],
  };
}

function deriveShift(assigned: string | null): string | null {
  if (!assigned) return null;
  const m = /^([ABC])[\s-]*shift\b/i.exec(assigned.trim());
  return m ? `${m[1].toUpperCase()} Shift` : null;
}

function setIdentifier(a: StagedAsset, value: string | null, cfg: AssetTypeConfig | undefined) {
  if (!value) return;
  if (cfg?.identifier === "imei" || (cfg?.identifier !== "serial" && looksLikeImei(value))) a.imei = value.replace(/\s+/g, "");
  else a.serialNumber = value;
}

function repairEntries(text: string | null) {
  if (!text) return [];
  return text
    .split(/[;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ date: findDateInText(t), text: t }));
}

// ── Legacy sheet readers ─────────────────────────────────────

type LegacyRecord = {
  sheet: string;
  row: number;
  ref: string;
  typePrefix: string;
  data: StagedAsset;
  raw: Record<string, unknown>;
};

function readTabSheet(g: Grid, size: 8 | 10, typeName: string, ctx: Ctx, ignored: IgnoredRow[]): LegacyRecord[] {
  const h = findHeaderRow(g, ["tab no"]);
  if (h < 0) return [];
  const headers = (g.rows[h] ?? []).map(headerKey);
  const c = {
    name: indexOfHeader(headers, "tab no"),
    opt: indexOfHeader(headers, "opt"),
    imei: indexOfHeader(headers, "imei"),
    inv: indexOfHeader(headers, "inventory number", "inventory"),
    asset: indexOfHeader(headers, "asset number"),
    sim: indexOfHeader(headers, "sim number", "sim no"),
    shift: indexOfHeader(headers, "shift"),
    location: indexOfHeader(headers, "location"),
    os: indexOfHeader(headers, "last os update"),
    remarks: indexOfHeader(headers, "remarks"),
    repair: indexOfHeader(headers, "repair"),
    num: indexOfHeader(headers, "#"),
  };
  const out: LegacyRecord[] = [];
  for (let i = h + 1; i < g.rows.length; i++) {
    const row = g.rows[i];
    if (!row) continue;
    const rowNo = i + 1;
    const name = str(at(row, c.name));
    const imei = str(at(row, c.imei));
    // A device row has a tablet number or a plausible IMEI; anything else is a legend / count row
    if (!name && !(imei && /^\d{8,}$/.test(imei))) {
      if (row.some((v) => str(v))) ignored.push({ sheet: g.name, row: rowNo, reason: "Legend / summary row (no device number or IMEI)" });
      continue;
    }
    const a = emptyAsset(typeName);
    a.deviceName = name;
    setIdentifier(a, imei, { identifier: "imei" });
    a.inventoryNumber = str(at(row, c.inv));
    a.assetNumber = str(at(row, c.asset));
    const sim = str(at(row, c.opt));
    a.simOperator = sim && sim.toLowerCase() !== "none" ? sim : null;
    a.simNumber = str(at(row, c.sim));
    a.lastOsUpdate = parseDateCell(at(row, c.os));
    a.remarks = str(at(row, c.remarks));
    a.repairs = repairEntries(str(at(row, c.repair)));
    if (size === 8) {
      a.assignedTo = str(at(row, c.shift));
      const alt = c.repair >= 0 ? str(row[c.repair + 1]) : null;
      if (alt && /^MPL\d+/i.test(alt)) a.alternateReference = alt;
    } else {
      const loc = str(at(row, c.location));
      if (loc) a.attributes.deploymentLocation = loc;
      const num = str(at(row, c.num));
      if (num) a.attributes.deviceCode = num;
      if (a.remarks && /without\s+charger/i.test(a.remarks)) a.attributes.chargerStatus = "Without charger";
      // Legacy "C", "B - 07.07.2026", "C-Yard", "HMT - 31.05.25": shift letter or place (+ date)
      if (loc) {
        const [place, when] = loc.split(/\s+-\s+/);
        const shiftMatch = /^([ABC])$/i.exec(place.trim());
        if (shiftMatch) {
          a.locationRaw = "COD";
          a.assignedTo = `${shiftMatch[1].toUpperCase()} Shift`;
          a.shift = a.assignedTo;
        } else {
          a.locationRaw = place.trim();
        }
        if (when) a.issuedDate = findDateInText(when);
      }
    }
    out.push({
      sheet: g.name, row: rowNo, ref: `${g.name} row ${rowNo}`, typePrefix: size === 8 ? "TAB8" : "TAB10", data: a,
      raw: rawRecord(labelsOf(g.rows[h]), row, 0, row.length),
    });
  }
  void ctx;
  return out;
}

function readPcSheet(g: Grid, typeName: string, ignored: IgnoredRow[]): LegacyRecord[] {
  const h = findHeaderRow(g, ["pc name"]);
  if (h < 0) return [];
  const headers = (g.rows[h] ?? []).map(headerKey);
  const c = {
    name: indexOfHeader(headers, "pc name"),
    inv: indexOfHeader(headers, "inventoy number", "inventory number", "invent"),
    asset: indexOfHeader(headers, "asset number"),
    monitors: indexOfHeader(headers, "number of monitors"),
    location: indexOfHeader(headers, "location"),
    inUse: indexOfHeader(headers, "in use"),
    received: indexOfHeader(headers, "recivied date", "received date"),
    remarks: indexOfHeader(headers, "remarks"),
  };
  const out: LegacyRecord[] = [];
  for (let i = h + 1; i < g.rows.length; i++) {
    const row = g.rows[i];
    if (!row) continue;
    const name = str(at(row, c.name));
    if (!name) {
      if (row.some((v) => str(v))) ignored.push({ sheet: g.name, row: i + 1, reason: "No PC name" });
      continue;
    }
    const a = emptyAsset(typeName);
    a.deviceName = name;
    a.inventoryNumber = str(at(row, c.inv));
    a.assetNumber = str(at(row, c.asset));
    a.locationRaw = str(at(row, c.location));
    a.assignedTo = str(at(row, c.inUse));
    a.receivedDate = parseDateCell(at(row, c.received));
    a.remarks = str(at(row, c.remarks));
    const mon = Number(str(at(row, c.monitors)));
    if (mon > 0) a.attributes.monitors = mon;
    if (a.assignedTo && /^non[\s-]*use/i.test(a.assignedTo)) a.statusName = "Not in Use";
    else a.statusName = "In Use";
    out.push({ sheet: g.name, row: i + 1, ref: `${g.name} row ${i + 1}`, typePrefix: "PC", data: a, raw: rawRecord(labelsOf(g.rows[h]), row) });
  }
  return out;
}

function readVhfSheet(g: Grid, typeName: string, brands: string[], ignored: IgnoredRow[]): LegacyRecord[] {
  const h = findHeaderRow(g, ["local code"]);
  if (h < 0) return [];
  const headers = (g.rows[h] ?? []).map(headerKey);
  const left = {
    local: headers.indexOf("local code"),
    mpl: headers.indexOf("mpl code"),
    brand: headers.indexOf("brand"),
    serial: headers.indexOf("serial no"),
    unit: headers.indexOf("unit"),
    loc: headers.findIndex((x) => x.startsWith("mch")),
  };
  const rightStart = Math.max(left.loc, left.unit) + 1;
  const find = (k: string) => {
    const i = headers.slice(rightStart).findIndex((x) => x === k);
    return i < 0 ? -1 : i + rightStart;
  };
  const right = { serial: find("serialno"), local: find("local code"), mpl: find("mplcode"), brand: find("brand"), unit: find("unit") };
  const out: LegacyRecord[] = [];
  for (let i = h + 1; i < g.rows.length; i++) {
    const row = g.rows[i];
    if (!row) continue;
    // Main list (columns A–G)
    const serial = str(at(row, left.serial));
    const local = normalizeCode(str(at(row, left.local)));
    const mpl = str(at(row, left.mpl));
    if (serial || local || mpl) {
      const a = emptyAsset(typeName);
      a.deviceName = local;
      a.inventoryNumber = mpl;
      setIdentifier(a, serial, { identifier: "serial" });
      const b = str(at(row, left.brand));
      if (b && /xir\s*p?3688/i.test(b)) a.model = "XiR P3688";
      a.brand = normalizeBrand(b, brands).value;
      const unit = str(at(row, left.unit));
      const locRaw = str(at(row, left.loc));
      if (locRaw) {
        const [place, ...rest] = locRaw.split(/\s+-\s+/);
        a.locationRaw = place;
        if (rest.length) a.remarks = rest.join(" - ");
      }
      if (unit) {
        const [u, when] = unit.split(/\s+-\s+/);
        if (/damaged/i.test(u)) a.statusName = "Damaged";
        else if (/in\s*stock/i.test(u)) a.statusName = "In Stock";
        else {
          a.statusName = "In Use";
          a.assignedTo = u.replace(/^([ABC])-?\s*shift$/i, (_, x) => `${x.toUpperCase()} Shift`);
          a.shift = deriveShift(a.assignedTo);
        }
        if (when) a.issuedDate = findDateInText(when);
      } else a.statusName = "In Use";
      out.push({ sheet: g.name, row: i + 1, ref: `${g.name} row ${i + 1}`, typePrefix: "VHF", data: a, raw: rawRecord(labelsOf(g.rows[h]), row, 0, rightStart) });
    }
    // "Unknown" list (columns K–P)
    const rSerial = str(at(row, right.serial));
    const rLocal = normalizeCode(str(at(row, right.local)));
    const rMpl = str(at(row, right.mpl));
    if (rSerial || rLocal || rMpl) {
      const a = emptyAsset(typeName);
      a.deviceName = rLocal;
      a.inventoryNumber = rMpl;
      setIdentifier(a, rSerial, { identifier: "serial" });
      a.brand = normalizeBrand(str(at(row, right.brand)), brands).value;
      a.statusName = "Unverified";
      const unit = str(at(row, right.unit));
      if (unit) a.remarks = `Unit: ${unit}`;
      a.remarks = ["From 'Unknown' list", a.remarks].filter(Boolean).join("; ");
      out.push({ sheet: g.name, row: i + 1, ref: `${g.name} row ${i + 1} (col K:P)`, typePrefix: "VHF", data: a, raw: rawRecord(labelsOf(g.rows[h]), row, rightStart, row.length) });
    } else if (!serial && !local && !mpl && row.some((v) => str(v)) && i > h + 1) {
      ignored.push({ sheet: g.name, row: i + 1, reason: "No serial, local code or MPL code" });
    }
  }
  return out;
}

// ── Main parser ──────────────────────────────────────────────

type IgnoredRow = { sheet: string; row: number; reason: string };
type Ctx = ImportContext & { locIdx: LocationIndex };

export async function parseWorkbook(buffer: ArrayBuffer | Buffer, fileName: string, context: ImportContext): Promise<StagedImport> {
  const grids = await loadGrids(buffer);
  const ctx: Ctx = { ...context, locIdx: buildLocationIndex(context.locations) };
  const byKey = new Map(grids.map((g) => [sheetKey(g.name), g]));
  const KNOWN: Record<string, string> = { assetregister: "Asset Register", movementlog: "Movement Log", lists: "Lists", tab8: 'Tab 8"', tab10: 'Tab 10"', pc: "PC", vhf: "VHF" };
  const sheetsFound = grids.filter((g) => KNOWN[sheetKey(g.name)]).map((g) => g.name);
  const sheetsIgnored = grids.filter((g) => !KNOWN[sheetKey(g.name)]).map((g) => g.name);
  const ignoredRows: IgnoredRow[] = [];

  const typeByPrefix = new Map(ctx.types.map((t) => [t.prefix.toUpperCase(), t]));
  const typeByName = new Map(ctx.types.map((t) => [t.name.toLowerCase().replace(/[“”″]/g, '"'), t]));
  const typeNameFor = (prefix: string, fallback: string) => typeByPrefix.get(prefix)?.name ?? fallback;

  // Reference lists from the "Lists" sheet
  const refAdd: ReferenceAdditions = { locations: [], statuses: [], simOperators: [], brands: [] };
  const lists = byKey.get("lists");
  if (lists) {
    const headers = (lists.rows[0] ?? []).map(headerKey);
    const col = (k: string) => headers.indexOf(k);
    const collect = (i: number) => {
      const vals: string[] = [];
      if (i < 0) return vals;
      for (let r = 1; r < lists.rows.length; r++) {
        const v = str(at(lists.rows[r], i));
        if (v && !/^add new values/i.test(v)) vals.push(v);
      }
      return vals;
    };
    const lower = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase()));
    const knownLocs = new Set([...ctx.locIdx.keys()]);
    refAdd.locations = collect(col("location")).filter((v) => !knownLocs.has(v.toLowerCase()));
    const ks = lower(ctx.statuses);
    refAdd.statuses = collect(col("status")).filter((v) => !ks.has(v.toLowerCase()));
    const ksim = lower(ctx.simOperators);
    refAdd.simOperators = collect(col("sim operator")).filter((v) => !ksim.has(v.toLowerCase()) && v.toLowerCase() !== "none");
    // Lists locations become known for this import
    for (const l of refAdd.locations) ctx.locIdx.set(l.toLowerCase(), l);
  }

  // Legacy sheets
  const legacy: LegacyRecord[] = [];
  const t8 = byKey.get("tab8");
  if (t8) legacy.push(...readTabSheet(t8, 8, typeNameFor("TAB8", 'Tablet 8"'), ctx, ignoredRows));
  const t10 = byKey.get("tab10");
  if (t10) legacy.push(...readTabSheet(t10, 10, typeNameFor("TAB10", 'Tablet 10"'), ctx, ignoredRows));
  const pc = byKey.get("pc");
  if (pc) legacy.push(...readPcSheet(pc, typeNameFor("PC", "PC"), ignoredRows));
  const vhf = byKey.get("vhf");
  if (vhf) legacy.push(...readVhfSheet(vhf, typeNameFor("VHF", "VHF"), ctx.brands, ignoredRows));

  const rows: StagedRow[] = [];
  const add = (r: StagedRow, code: IssueCode, message: string) => {
    if (!r.issues.some((i) => i.code === code && i.message === message)) r.issues.push({ code, message });
  };

  // Asset Register (preferred: already the consolidated list)
  const reg = byKey.get("assetregister");
  let mode: "register" | "legacy" = "legacy";
  if (reg) {
    const h = findHeaderRow(reg, ["asset id", "asset type"]);
    if (h >= 0) {
      mode = "register";
      const headers = (reg.rows[h] ?? []).map(headerKey);
      const H = (k: string) => headers.indexOf(k);
      const c = {
        id: H("asset id"), type: H("asset type"), name: H("device name / code"), brand: H("brand"), model: H("model"),
        serial: H("serial / imei"), inv: H("inventory no"), assetNo: H("asset no"), alt: H("alt ref no"), sim: H("sim / operator"),
        loc: H("location"), assigned: H("assigned to / shift"), status: H("status"), issued: H("issued date"), os: H("last os update"),
        verified: H("last verified"), repair: H("repair history"), remarks: H("remarks"), source: H("source"),
      };
      for (let i = h + 1; i < reg.rows.length; i++) {
        const row = reg.rows[i];
        if (!row) continue;
        const assetId = normalizeCode(str(at(row, c.id)));
        const typeRaw = str(at(row, c.type));
        if (!assetId && !typeRaw) {
          if (row.some((v) => str(v))) ignoredRows.push({ sheet: reg.name, row: i + 1, reason: "No Asset ID or type" });
          continue;
        }
        const type = typeRaw ? typeByName.get(typeRaw.toLowerCase().replace(/[“”″]/g, '"')) : undefined;
        const a = emptyAsset(type?.name ?? typeRaw ?? "?");
        a.assetId = assetId;
        a.deviceName = str(at(row, c.name));
        a.model = str(at(row, c.model));
        a.inventoryNumber = str(at(row, c.inv));
        a.assetNumber = str(at(row, c.assetNo));
        a.alternateReference = str(at(row, c.alt));
        const sim = splitSim(str(at(row, c.sim)));
        a.simOperator = sim.operator;
        a.simNumber = sim.number;
        a.locationRaw = str(at(row, c.loc));
        a.assignedTo = str(at(row, c.assigned));
        a.shift = deriveShift(a.assignedTo);
        a.issuedDate = parseDateCell(at(row, c.issued));
        a.lastOsUpdate = parseDateCell(at(row, c.os));
        a.lastVerified = parseDateCell(at(row, c.verified));
        a.remarks = str(at(row, c.remarks));
        a.repairs = repairEntries(str(at(row, c.repair)));
        setIdentifier(a, str(at(row, c.serial)), type?.config);
        const sourceRef = str(at(row, c.source)) ?? `${reg.name} row ${i + 1}`;
        const staged: StagedRow = {
          key: `R${i + 1}`, kind: "asset", sheet: reg.name, rowNumber: i + 1, sourceRef, data: a,
          raw: rawRecord(labelsOf(reg.rows[h]), row), legacy: [], issues: [], include: true,
        };
        const brand = normalizeBrand(str(at(row, c.brand)), ctx.brands);
        a.brand = brand.value;
        if (brand.changed) add(staged, "VALUE_NORMALIZED", `Brand "${str(at(row, c.brand))}" → "${brand.value}"`);
        const statusRaw = str(at(row, c.status));
        a.statusName = statusRaw ?? "Unverified";
        if (!type) add(staged, "INVALID_TYPE", `Asset type "${typeRaw ?? ""}" is not configured`);
        if (!assetId) add(staged, "VALUE_NORMALIZED", "No Asset ID — one will be generated");
        rows.push(staged);
      }
    }
  }

  // Match legacy sheet rows to register rows
  const byRef = new Map(rows.map((r) => [r.sourceRef.toLowerCase(), r]));
  const byIdent = new Map<string, StagedRow>();
  for (const r of rows) {
    const k = idKey(r.data.imei ?? r.data.serialNumber);
    if (k && !byIdent.has(k)) byIdent.set(k, r);
  }
  for (const l of legacy) {
    const lk = idKey(l.data.imei ?? l.data.serialNumber);
    let match = byRef.get(l.ref.toLowerCase());
    if (!match && lk) match = byIdent.get(lk);
    if (!match && l.data.deviceName && mode === "register") {
      const cands = rows.filter((r) => r.data.typeName === l.data.typeName && r.data.deviceName?.toLowerCase() === l.data.deviceName!.toLowerCase());
      if (cands.length === 1) match = cands[0];
    }
    if (match) {
      match.legacy.push({ sheet: l.sheet, row: l.row, raw: l.raw });
      const rk = idKey(match.data.imei ?? match.data.serialNumber);
      if (lk && rk && lk !== rk) {
        add(match, "LEGACY_MISMATCH", `${l.ref}: serial/IMEI ${l.data.imei ?? l.data.serialNumber} differs from register ${match.data.imei ?? match.data.serialNumber}`);
      }
      // Enrich only empty fields — never overwrite register values
      const d = match.data;
      for (const f of ["simNumber", "inventoryNumber", "assetNumber", "alternateReference", "receivedDate", "model"] as const) {
        if (!d[f] && l.data[f]) d[f] = l.data[f];
      }
      d.attributes = { ...l.data.attributes, ...d.attributes };
      if (!d.repairs.length && l.data.repairs.length) d.repairs = l.data.repairs;
    } else if (mode === "register") {
      rows.push({
        key: `L-${l.ref}`, kind: "asset", sheet: l.sheet, rowNumber: l.row, sourceRef: l.ref, data: { ...l.data, locationRaw: l.data.locationRaw },
        raw: l.raw, legacy: [{ sheet: l.sheet, row: l.row, raw: l.raw }],
        issues: [{ code: "LEGACY_UNMATCHED", message: `${l.ref} has no matching row in the Asset Register — review before importing` }],
        include: false,
      });
    } else {
      rows.push({
        key: `L-${l.ref}`, kind: "asset", sheet: l.sheet, rowNumber: l.row, sourceRef: l.ref, data: l.data,
        raw: l.raw, legacy: [{ sheet: l.sheet, row: l.row, raw: l.raw }], issues: [], include: true,
      });
    }
  }

  // Per-row normalisation & data-quality checks
  const statusLower = new Map(ctx.statuses.map((s) => [s.toLowerCase(), s]));
  for (const s of refAdd.statuses) statusLower.set(s.toLowerCase(), s);
  for (const r of rows) {
    const d = r.data;
    const loc = resolveLocation(d.locationRaw, ctx.locIdx);
    d.locationName = loc.name;
    if (loc.status === "normalized") add(r, "LOCATION_NORMALIZED", `Location "${d.locationRaw}" → "${loc.name}"`);
    if (loc.status === "unknown") add(r, "UNKNOWN_LOCATION", `Location "${d.locationRaw}" is not a configured location — it will be created`);
    if (loc.status === "missing") add(r, "MISSING_LOCATION", "No location recorded");
    const st = statusLower.get(d.statusName.toLowerCase());
    if (st) d.statusName = st;
    else {
      add(r, "UNKNOWN_STATUS", `Status "${d.statusName}" is not configured — imported as Unverified`);
      d.statusName = statusLower.get("unverified") ?? "Unverified";
    }
    if (/^damaged$/i.test(d.statusName) && !d.condition) d.condition = "Damaged";
    if (!d.imei && !d.serialNumber) add(r, "MISSING_SERIAL", "No serial number / IMEI");
    if (!d.inventoryNumber) add(r, "MISSING_INVENTORY", "No inventory number");
    if (!d.assetNumber) add(r, "MISSING_ASSET_NO", "No asset number");
  }

  // Duplicates inside the file
  const idSeen = new Map<string, StagedRow>();
  for (const r of rows) {
    if (!r.data.assetId) continue;
    const k = r.data.assetId.toUpperCase();
    const prev = idSeen.get(k);
    if (prev) {
      add(r, "DUPLICATE_ID", `Asset ID ${r.data.assetId} already used on ${prev.sheet} row ${prev.rowNumber}`);
      r.include = false;
    } else idSeen.set(k, r);
  }
  const groupBy = (keyOf: (r: StagedRow) => string | null) => {
    const m = new Map<string, StagedRow[]>();
    for (const r of rows) {
      const k = keyOf(r);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  };
  for (const g of groupBy((r) => idKey(r.data.imei ?? r.data.serialNumber))) {
    for (const r of g) {
      const others = g.filter((o) => o !== r).map((o) => o.data.assetId ?? o.sourceRef);
      add(r, "POSSIBLE_DUPLICATE", `Same serial/IMEI ${r.data.imei ?? r.data.serialNumber} as ${others.join(", ")}`);
    }
  }
  const uniqueNameTypes = new Set(ctx.types.filter((t) => t.config.uniqueName).map((t) => t.name));
  for (const g of groupBy((r) => (uniqueNameTypes.has(r.data.typeName) && r.data.deviceName ? `${r.data.typeName}|${r.data.deviceName.toUpperCase()}` : null))) {
    for (const r of g) {
      const others = g.filter((o) => o !== r).map((o) => o.data.assetId ?? o.sourceRef);
      add(r, "DUPLICATE_NAME", `Device name "${r.data.deviceName}" also used by ${others.join(", ")}`);
    }
  }

  // Compare with what is already in the database
  const existingIds = new Set(ctx.existing.map((e) => e.assetId.toUpperCase()));
  const existingIdent = new Map<string, string>();
  for (const e of ctx.existing) {
    for (const v of [e.imei, e.serialNumber]) {
      const k = idKey(v);
      if (k) existingIdent.set(k, e.assetId);
    }
  }
  for (const r of rows) {
    if (r.data.assetId && existingIds.has(r.data.assetId.toUpperCase())) {
      add(r, "EXISTS_IN_DB", `${r.data.assetId} is already registered — existing record kept`);
      r.include = false;
      continue;
    }
    const k = idKey(r.data.imei ?? r.data.serialNumber);
    const hit = k ? existingIdent.get(k) : undefined;
    if (hit) {
      add(r, "POSSIBLE_DUPLICATE", `Serial/IMEI already registered on ${hit}`);
      r.include = false;
    }
    if (r.issues.some((i) => ISSUE_META[i.code].severity === "error")) r.include = false;
  }

  // Movement Log
  const movements: StagedMovement[] = [];
  const mlog = byKey.get("movementlog");
  if (mlog) {
    const h = findHeaderRow(mlog, ["date", "asset id", "action"]);
    if (h >= 0) {
      const headers = (mlog.rows[h] ?? []).map(headerKey);
      const H = (k: string) => headers.indexOf(k);
      const actionByLabel = new Map(Object.entries(ACTION_LABELS).map(([k, v]) => [v.toLowerCase(), k]));
      const knownIds = new Set([...idSeen.keys(), ...existingIds]);
      for (let i = h + 1; i < mlog.rows.length; i++) {
        const row = mlog.rows[i];
        if (!row) continue;
        const date = parseDateCell(at(row, H("date")));
        const assetId = normalizeCode(str(at(row, H("asset id"))));
        if (!date || !assetId) {
          if (row.some((v) => str(v)) && (date || assetId)) ignoredRows.push({ sheet: mlog.name, row: i + 1, reason: "Movement row without date or Asset ID" });
          else if (row.some((v) => str(v))) ignoredRows.push({ sheet: mlog.name, row: i + 1, reason: "Empty template row" });
          continue;
        }
        const actionRaw = str(at(row, H("action"))) ?? "";
        const m: StagedMovement = {
          key: `M${i + 1}`, kind: "movement", sheet: mlog.name, rowNumber: i + 1, date, assetId,
          action: actionByLabel.get(actionRaw.toLowerCase()) ?? "STATUS_CHANGE",
          from: str(at(row, H("from"))), to: str(at(row, H("to"))), assignedTo: str(at(row, H("assigned to"))),
          doneBy: str(at(row, H("done by"))), notes: [str(at(row, H("notes"))), actionByLabel.has(actionRaw.toLowerCase()) ? null : `Action: ${actionRaw}`].filter(Boolean).join(" · ") || null,
          issues: [], include: true,
        };
        if (!knownIds.has(assetId.toUpperCase())) {
          m.issues.push({ code: "UNKNOWN_ASSET", message: `Asset ${assetId} is not in the register` });
          m.include = false;
        }
        movements.push(m);
      }
    }
  }

  // Summary
  const byType: Record<string, number> = {};
  const issueCounts: Partial<Record<IssueCode, number>> = {};
  for (const r of rows) {
    byType[r.data.typeName] = (byType[r.data.typeName] ?? 0) + 1;
    for (const code of new Set(r.issues.map((i) => i.code))) issueCounts[code] = (issueCounts[code] ?? 0) + 1;
  }
  for (const m of movements) for (const i of m.issues) issueCounts[i.code] = (issueCounts[i.code] ?? 0) + 1;

  return {
    summary: {
      fileName, sheetsFound, sheetsIgnored, byType, totalAssets: rows.length, movements: movements.length,
      ignoredRows, issueCounts, referenceAdditions: refAdd, mode,
    },
    rows,
    movements,
  };
}

export type { Issue };
