import { prisma } from "@/lib/db";
import { ACTION_LABELS, REPAIR_STATUS_LABELS, SEVERITY_LABELS, VERIFICATION_RESULT_LABELS, VERIFICATION_STATE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, todayDate } from "@/lib/utils";
import { parseAssetFilters, type AssetFilters } from "@/lib/asset-filters";
import { listAssets, getAssetDetail } from "./assets";
import { listMovements, parseMovementFilters, listAudit, parseAuditFilters } from "./history";
import { getSettings } from "./settings";
import { listStaff } from "./staff";
import { labelFor, parseTypeConfig } from "@/lib/asset-type-config";

export type Cell = string | number | null;
export type ReportColumn = { key: string; label: string; width?: number };
export type ReportSection = { title?: string; columns: ReportColumn[]; rows: Record<string, Cell>[] };
export type ReportResult = { title: string; subtitle: string; sections: ReportSection[] };

type SP = Record<string, string | string[] | undefined>;

export const REPORTS = [
  { key: "asset-register", title: "Asset Register", description: "All assets with their current state.", kind: "assets" },
  { key: "by-location", title: "Assets by Location", description: "Every asset grouped by its current location.", kind: "assets" },
  { key: "by-type", title: "Assets by Type", description: "Tablets, PCs and VHF radios grouped by type.", kind: "assets" },
  { key: "under-repair", title: "Assets Under Repair", description: "Repair cases — open and closed.", kind: "repairs" },
  { key: "damaged", title: "Damaged Assets", description: "Assets currently marked damaged, with their latest damage report.", kind: "assets" },
  { key: "lost", title: "Missing / Lost Assets", description: "Assets marked lost and the recorded reason.", kind: "assets" },
  { key: "verification", title: "Verification Report", description: "Verified, due soon and overdue assets.", kind: "assets" },
  { key: "movements", title: "Movement Report", description: "Movement history filtered by date, asset, action, location or user.", kind: "movements" },
  { key: "staff", title: "Staff & Devices Held", description: "Staff list with the devices each person currently holds.", kind: "staff" },
  { key: "audit", title: "Audit Trail", description: "Every recorded change (administrators and officers).", kind: "audit" },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"] | "asset-record";

const ASSET_COLUMNS: ReportColumn[] = [
  { key: "assetId", label: "Asset ID", width: 14 },
  { key: "type", label: "Asset Type", width: 12 },
  { key: "deviceName", label: "Device Name / Code", width: 24 },
  { key: "brand", label: "Brand", width: 12 },
  { key: "model", label: "Model", width: 12 },
  { key: "serial", label: "Serial / IMEI", width: 18 },
  { key: "inventoryNumber", label: "Inventory No.", width: 14 },
  { key: "assetNumber", label: "Asset No.", width: 24 },
  { key: "alternateReference", label: "Alt Ref No.", width: 12 },
  { key: "sim", label: "SIM / Operator", width: 22 },
  { key: "location", label: "Location", width: 14 },
  { key: "assignedTo", label: "Assigned To / Shift", width: 18 },
  { key: "status", label: "Status", width: 12 },
  { key: "condition", label: "Condition", width: 10 },
  { key: "lastVerification", label: "Last Verification", width: 13 },
  { key: "nextVerification", label: "Next Verification", width: 13 },
  { key: "verificationState", label: "Verification", width: 11 },
  { key: "lastOsUpdate", label: "Last OS Update", width: 13 },
  { key: "remarks", label: "Remarks", width: 30 },
];

type ListedAsset = Awaited<ReturnType<typeof listAssets>>["rows"][number];

function assetRow(a: ListedAsset): Record<string, Cell> {
  const sim = [a.simOperator, a.simNumber].filter(Boolean).join(" / ");
  const assigned = [a.assignedTo, a.shift && a.shift !== a.assignedTo ? a.shift : null].filter(Boolean).join(" · ");
  return {
    assetId: a.assetId,
    type: a.assetType.name,
    deviceName: a.deviceName,
    brand: a.brand,
    model: a.model,
    serial: a.imei || a.serialNumber,
    inventoryNumber: a.inventoryNumber,
    assetNumber: a.assetNumber,
    alternateReference: a.alternateReference,
    sim: sim || null,
    location: a.location?.name ?? null,
    assignedTo: assigned || null,
    status: a.status.name,
    condition: a.condition,
    lastVerification: a.lastVerificationDate ? formatDate(a.lastVerificationDate) : null,
    nextVerification: a.nextVerificationDate ? formatDate(a.nextVerificationDate) : null,
    verificationState: VERIFICATION_STATE_LABELS[a.verification],
    lastOsUpdate: a.lastOsUpdate ? formatDate(a.lastOsUpdate) : null,
    remarks: a.remarks,
  };
}

async function describeAssetFilters(f: AssetFilters) {
  const parts: string[] = [];
  if (f.q) parts.push(`Search "${f.q}"`);
  if (f.type?.length) {
    const t = await prisma.assetType.findMany({ where: { id: { in: f.type } } });
    parts.push(`Type: ${t.map((x) => x.name).join(", ")}`);
  }
  if (f.status?.length) {
    const s = await prisma.status.findMany({ where: { id: { in: f.status } } });
    parts.push(`Status: ${s.map((x) => x.name).join(", ")}`);
  }
  if (f.statusCode?.length) parts.push(`Status: ${f.statusCode.join(", ")}`);
  if (f.location?.length) {
    const l = await prisma.location.findMany({ where: { id: { in: f.location } } });
    parts.push(`Location: ${[...l.map((x) => x.name), ...(f.location.includes("none") ? ["(none)"] : [])].join(", ")}`);
  }
  if (f.condition?.length) parts.push(`Condition: ${f.condition.join(", ")}`);
  if (f.verification?.length) parts.push(`Verification: ${f.verification.map((v) => VERIFICATION_STATE_LABELS[v]).join(", ")}`);
  if (f.review) parts.push("Needs review");
  return parts.length ? parts.join(" · ") : "All records";
}

function groupSections(rows: ListedAsset[], keyOf: (a: ListedAsset) => string, cols = ASSET_COLUMNS): ReportSection[] {
  const groups = new Map<string, ListedAsset[]>();
  for (const r of rows) {
    const k = keyOf(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "No location" ? 1 : b === "No location" ? -1 : a.localeCompare(b)))
    .map(([title, list]) => ({ title: `${title} (${list.length})`, columns: cols, rows: list.map(assetRow) }));
}

export async function buildReport(key: ReportKey, sp: SP): Promise<ReportResult> {
  const generated = `Generated ${formatDateTime(new Date())}`;
  const assetFilters = parseAssetFilters(sp);

  switch (key) {
    case "asset-register":
    case "by-location":
    case "by-type": {
      const { rows } = await listAssets(assetFilters, { all: true });
      const subtitle = `${await describeAssetFilters(assetFilters)} · ${rows.length} assets · ${generated}`;
      if (key === "asset-register") return { title: "Asset Register", subtitle, sections: [{ columns: ASSET_COLUMNS, rows: rows.map(assetRow) }] };
      if (key === "by-location") return { title: "Assets by Location", subtitle, sections: groupSections(rows, (a) => a.location?.name ?? "No location") };
      return { title: "Assets by Type", subtitle, sections: groupSections(rows, (a) => a.assetType.name) };
    }
    case "damaged":
    case "lost": {
      const code = key === "damaged" ? "DAMAGED" : "LOST";
      const f = { ...assetFilters, statusCode: [code] };
      const { rows } = await listAssets(f, { all: true });
      const ids = rows.map((r) => r.id);
      const extra = new Map<string, Record<string, Cell>>();
      if (key === "damaged") {
        const reports = await prisma.damageReport.findMany({ where: { assetId: { in: ids } }, orderBy: { date: "desc" } });
        for (const r of reports) if (!extra.has(r.assetId)) extra.set(r.assetId, { damageDate: formatDate(r.date), severity: SEVERITY_LABELS[r.severity], damage: r.description, reportedBy: r.reportedBy });
      } else {
        const moves = await prisma.movement.findMany({ where: { assetId: { in: ids }, OR: [{ action: "MARK_LOST" }, { statusAfter: { in: ["Lost"] } }] }, orderBy: { date: "desc" } });
        for (const m of moves) if (!extra.has(m.assetId)) extra.set(m.assetId, { lostDate: formatDate(m.date), reason: m.reason ?? m.notes, reportedBy: m.doneBy });
      }
      const extraCols: ReportColumn[] =
        key === "damaged"
          ? [{ key: "damageDate", label: "Reported", width: 12 }, { key: "severity", label: "Severity", width: 10 }, { key: "damage", label: "Damage", width: 30 }, { key: "reportedBy", label: "Reported By", width: 16 }]
          : [{ key: "lostDate", label: "Date", width: 12 }, { key: "reason", label: "Reason", width: 30 }, { key: "reportedBy", label: "Reported By", width: 16 }];
      const cols = [...ASSET_COLUMNS.filter((c) => ["assetId", "type", "deviceName", "serial", "inventoryNumber", "location", "assignedTo", "condition"].includes(c.key)), ...extraCols, { key: "remarks", label: "Remarks", width: 30 }];
      return {
        title: key === "damaged" ? "Damaged Assets" : "Missing / Lost Assets",
        subtitle: `${rows.length} assets · ${generated}`,
        sections: [{ columns: cols, rows: rows.map((a) => ({ ...assetRow(a), ...(extra.get(a.id) ?? {}) })) }],
      };
    }
    case "verification": {
      const { rows, settings } = await listAssets({ ...assetFilters, sort: assetFilters.sort ?? "nextVerificationDate" }, { all: true });
      const cols = ASSET_COLUMNS.filter((c) => ["assetId", "type", "deviceName", "location", "assignedTo", "status", "lastVerification", "nextVerification", "verificationState"].includes(c.key));
      const order = ["OVERDUE", "DUE_SOON", "VERIFIED"] as const;
      const eligible = rows.filter((r) => r.status.code !== "DISPOSED");
      return {
        title: "Verification Report",
        subtitle: `Interval ${settings.verificationIntervalDays} days · due-soon window ${settings.dueSoonDays} days · ${eligible.length} assets · ${generated}`,
        sections: order
          .map((st) => ({ st, list: eligible.filter((r) => r.verification === st) }))
          .filter((g) => g.list.length)
          .map((g) => ({ title: `${VERIFICATION_STATE_LABELS[g.st]} (${g.list.length})`, columns: cols, rows: g.list.map(assetRow) })),
      };
    }
    case "under-repair": {
      const status = (Array.isArray(sp.repairStatus) ? sp.repairStatus[0] : sp.repairStatus) || "ALL";
      const repairs = await prisma.repair.findMany({
        where: status === "ALL" ? {} : { status: status as never },
        orderBy: [{ status: "asc" }, { repairOutDate: { sort: "desc", nulls: "last" } }],
        include: { asset: { include: { assetType: true } } },
      });
      return {
        title: "Assets Under Repair",
        subtitle: `${status === "ALL" ? "All repair cases" : REPAIR_STATUS_LABELS[status as keyof typeof REPAIR_STATUS_LABELS]} · ${repairs.length} cases · ${generated}`,
        sections: [{
          columns: [
            { key: "assetId", label: "Asset ID", width: 14 }, { key: "type", label: "Type", width: 12 }, { key: "device", label: "Device", width: 20 },
            { key: "status", label: "Repair Status", width: 13 }, { key: "out", label: "Repair Out", width: 12 }, { key: "problem", label: "Reported Problem", width: 30 },
            { key: "technician", label: "Vendor / Technician", width: 18 }, { key: "expected", label: "Expected Return", width: 13 }, { key: "in", label: "Returned", width: 12 },
            { key: "description", label: "Repair Description", width: 30 }, { key: "parts", label: "Parts Replaced", width: 18 }, { key: "cost", label: "Cost", width: 10 },
          ],
          rows: repairs.map((r) => ({
            assetId: r.asset.assetId, type: r.asset.assetType.name, device: r.asset.deviceName, status: REPAIR_STATUS_LABELS[r.status],
            out: r.repairOutDate ? formatDate(r.repairOutDate) : null, problem: r.reportedProblem, technician: r.technician,
            expected: r.expectedReturnDate ? formatDate(r.expectedReturnDate) : null, in: r.repairInDate ? formatDate(r.repairInDate) : null,
            description: r.repairDescription, parts: r.partsReplaced, cost: r.cost ? Number(r.cost) : null,
          })),
        }],
      };
    }
    case "movements": {
      const f = parseMovementFilters(sp);
      const { rows } = await listMovements(f, true);
      const parts = [f.from && `From ${f.from}`, f.to && `To ${f.to}`, f.asset && `Asset "${f.asset}"`, f.action && `Action ${ACTION_LABELS[f.action as keyof typeof ACTION_LABELS] ?? f.action}`, f.location && `Location ${f.location}`, f.user && `User "${f.user}"`].filter(Boolean);
      return {
        title: "Movement Report",
        subtitle: `${parts.length ? parts.join(" · ") : "All movements"} · ${rows.length} records · ${generated}`,
        sections: [{
          columns: [
            { key: "date", label: "Date", width: 12 }, { key: "assetId", label: "Asset ID", width: 14 }, { key: "device", label: "Device", width: 20 },
            { key: "action", label: "Action", width: 12 }, { key: "from", label: "From", width: 14 }, { key: "to", label: "To", width: 14 },
            { key: "assignedTo", label: "Assigned To", width: 16 }, { key: "status", label: "Status After", width: 12 }, { key: "doneBy", label: "Done By", width: 16 }, { key: "notes", label: "Notes / Reason", width: 30 },
          ],
          rows: rows.map((m) => ({
            date: formatDate(m.date), assetId: m.asset.assetId, device: m.asset.deviceName, action: ACTION_LABELS[m.action],
            from: m.fromLocation, to: m.toLocation, assignedTo: m.assignedTo, status: m.statusAfter, doneBy: m.doneBy ?? m.recordedBy?.name ?? null,
            notes: [m.reason, m.notes].filter(Boolean).join(" — ") || null,
          })),
        }],
      };
    }
    case "staff": {
      const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined));
      const status = (one("status") === "inactive" || one("status") === "all" ? one("status") : "active") as "active" | "inactive" | "all";
      const staff = await listStaff({ q: one("q"), shift: one("shift"), status, holding: one("holding") === "1" });
      return {
        title: "Staff & Devices Held",
        subtitle: `${staff.length} staff · ${staff.reduce((n, s) => n + s.assets.length, 0)} devices held · ${generated}`,
        sections: [{
          columns: [
            { key: "emp", label: "Employee No.", width: 14 }, { key: "name", label: "Name", width: 24 }, { key: "designation", label: "Designation", width: 18 },
            { key: "shift", label: "Shift", width: 10 }, { key: "department", label: "Department", width: 18 }, { key: "phone", label: "Phone", width: 12 },
            { key: "count", label: "Devices", width: 8 }, { key: "devices", label: "Devices Held", width: 40 }, { key: "status", label: "Status", width: 9 },
          ],
          rows: staff.map((s) => ({
            emp: s.employeeNumber, name: s.name, designation: s.designation, shift: s.shift, department: s.department, phone: s.phone,
            count: s.assets.length, devices: s.assets.map((a) => a.assetId).join(", ") || null, status: s.active ? "Active" : "Inactive",
          })),
        }],
      };
    }
    case "audit": {
      const f = parseAuditFilters(sp);
      const { rows } = await listAudit(f, true);
      return {
        title: "Audit Trail",
        subtitle: `${rows.length} entries · ${generated}`,
        sections: [{
          columns: [
            { key: "at", label: "Date / Time", width: 18 }, { key: "user", label: "User", width: 16 }, { key: "action", label: "Action", width: 14 },
            { key: "asset", label: "Asset", width: 12 }, { key: "message", label: "Change", width: 50 }, { key: "old", label: "Previous Value", width: 20 }, { key: "new", label: "New Value", width: 20 },
          ],
          rows: rows.map((r) => ({ at: formatDateTime(r.createdAt), user: r.userName, action: r.action, asset: r.assetCode, message: r.message, old: r.oldValue, new: r.newValue })),
        }],
      };
    }
    case "asset-record": {
      const code = (Array.isArray(sp.asset) ? sp.asset[0] : sp.asset) ?? "";
      const d = await getAssetDetail(code);
      if (!d) throw new Error("Asset not found");
      const { asset: a } = d;
      const cfg = parseTypeConfig(a.assetType.config);
      const attrs = (a.attributes ?? {}) as Record<string, unknown>;
      const info: [string, Cell][] = [
        ["Asset ID", a.assetId], ["Asset Type", a.assetType.name], [labelFor(cfg, "deviceName"), a.deviceName], ["Brand", a.brand], ["Model", a.model],
        ["Serial Number", a.serialNumber], ["IMEI", a.imei], [labelFor(cfg, "inventoryNumber"), a.inventoryNumber], ["Asset Number", a.assetNumber],
        ["Alt. Reference", a.alternateReference], ["SIM Operator", a.simOperator], ["SIM Number", a.simNumber], ["Location", a.location?.name ?? null],
        ["Assigned To", a.assignedTo], ["Shift", a.shift], ["Department", a.department], ["Status", a.status.name], ["Condition", a.condition],
        ["Received Date", a.receivedDate ? formatDate(a.receivedDate) : null], ["Last Service", a.lastServiceDate ? formatDate(a.lastServiceDate) : null],
        ["Last OS Update", a.lastOsUpdate ? formatDate(a.lastOsUpdate) : null], ["OS Version", a.osVersion],
        ["Last Verification", a.lastVerificationDate ? formatDate(a.lastVerificationDate) : null], ["Next Verification", a.nextVerificationDate ? formatDate(a.nextVerificationDate) : null],
        ["Verification Status", VERIFICATION_STATE_LABELS[d.verification]],
        ...(cfg.extraFields ?? []).map((f) => [f.label, attrs[f.key] == null ? null : String(attrs[f.key])] as [string, Cell]),
        ["Remarks", a.remarks],
      ];
      return {
        title: `Asset Record — ${a.assetId}`,
        subtitle: `${a.assetType.name}${a.deviceName ? ` · ${a.deviceName}` : ""} · ${generated}`,
        sections: [
          { title: "Asset Information", columns: [{ key: "field", label: "Field", width: 22 }, { key: "value", label: "Value", width: 50 }], rows: info.map(([field, value]) => ({ field, value })) },
          {
            title: "Movement History",
            columns: [{ key: "date", label: "Date", width: 12 }, { key: "action", label: "Action", width: 12 }, { key: "from", label: "From", width: 14 }, { key: "to", label: "To", width: 14 }, { key: "assignedTo", label: "Assigned To", width: 16 }, { key: "status", label: "Status After", width: 12 }, { key: "doneBy", label: "Done By", width: 14 }, { key: "notes", label: "Notes", width: 30 }],
            rows: a.movements.map((m) => ({ date: formatDate(m.date), action: ACTION_LABELS[m.action], from: m.fromLocation, to: m.toLocation, assignedTo: m.assignedTo, status: m.statusAfter, doneBy: m.doneBy ?? m.recordedBy?.name ?? null, notes: [m.reason, m.notes].filter(Boolean).join(" — ") || null })),
          },
          {
            title: "Repair History",
            columns: [{ key: "out", label: "Repair Date", width: 12 }, { key: "problem", label: "Problem", width: 24 }, { key: "action", label: "Repair Action", width: 24 }, { key: "technician", label: "Vendor / Technician", width: 16 }, { key: "cost", label: "Cost", width: 10 }, { key: "in", label: "Return Date", width: 12 }, { key: "status", label: "Status", width: 12 }, { key: "notes", label: "Remarks", width: 24 }],
            rows: a.repairs.map((r) => ({ out: r.repairOutDate ? formatDate(r.repairOutDate) : null, problem: r.reportedProblem, action: [r.repairDescription, r.partsReplaced && `Parts: ${r.partsReplaced}`].filter(Boolean).join(" — ") || null, technician: r.technician, cost: r.cost ? Number(r.cost) : null, in: r.repairInDate ? formatDate(r.repairInDate) : null, status: REPAIR_STATUS_LABELS[r.status], notes: r.notes })),
          },
          {
            title: "Verification History",
            columns: [{ key: "date", label: "Date", width: 12 }, { key: "result", label: "Result", width: 18 }, { key: "location", label: "Physical Location", width: 16 }, { key: "assigned", label: "Assigned User", width: 16 }, { key: "condition", label: "Condition", width: 10 }, { key: "by", label: "Verified By", width: 14 }, { key: "remarks", label: "Remarks", width: 24 }],
            rows: a.verifications.map((v) => ({ date: formatDate(v.verificationDate), result: VERIFICATION_RESULT_LABELS[v.result], location: v.physicalLocation, assigned: v.assignedUser, condition: v.condition, by: v.verifiedBy, remarks: v.remarks })),
          },
          {
            title: "Damage Reports",
            columns: [{ key: "date", label: "Date", width: 12 }, { key: "severity", label: "Severity", width: 10 }, { key: "description", label: "Description", width: 30 }, { key: "by", label: "Reported By", width: 14 }, { key: "location", label: "Location", width: 14 }, { key: "notes", label: "Notes", width: 24 }],
            rows: a.damageReports.map((r) => ({ date: formatDate(r.date), severity: SEVERITY_LABELS[r.severity], description: r.description, by: r.reportedBy, location: r.location, notes: r.notes })),
          },
          {
            title: "OS Updates",
            columns: [{ key: "date", label: "Update Date", width: 12 }, { key: "version", label: "OS Version", width: 14 }, { key: "by", label: "Updated By", width: 14 }, { key: "notes", label: "Notes", width: 30 }],
            rows: a.osUpdates.map((o) => ({ date: formatDate(o.updateDate), version: o.osVersion, by: o.updatedBy, notes: o.notes })),
          },
        ],
      };
    }
  }
}

export async function reportMeta() {
  const s = await getSettings();
  return { organization: s.organizationName, system: s.systemName, today: formatDate(todayDate()) };
}
