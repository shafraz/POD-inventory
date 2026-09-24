/**
 * Seed script
 *  1. Reference data (asset types, statuses, locations, lookups, settings) —
 *     locations / statuses / SIM operators are read from the workbook's "Lists" sheet.
 *  2. Initial administrator (+ optional demo users for each role).
 *  3. Initial data migration: imports "Inventory TEst.xlsx" through the SAME import
 *     pipeline the admin screen uses (register consolidated, legacy sheets cross-checked,
 *     uncertain records flagged for review). Skipped if assets already exist.
 *
 * Run: npm run db:seed   (SEED_WORKBOOK=/path/to/file.xlsx to use another workbook)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { StatusCode, LookupCategory, Role } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { saveSettings, DEFAULT_SETTINGS } from "../src/lib/services/settings";
import type { AssetTypeConfig } from "../src/lib/asset-type-config";
import { parseWorkbook } from "../src/lib/import/parse";
import { commitImport, loadImportContext } from "../src/lib/import/commit";

const WORKBOOK = process.env.SEED_WORKBOOK || path.join(__dirname, "data", "Inventory TEst.xlsx");

const ASSET_TYPES: { name: string; prefix: string; description: string; config: AssetTypeConfig }[] = [
  {
    name: 'Tablet 8"', prefix: "TAB8", description: "8-inch operational tablets (tally / yard)",
    config: { identifier: "imei", hasSim: true, hasOs: true, uniqueName: true, labels: { deviceName: "Tablet Number" }, extraFields: [] },
  },
  {
    name: 'Tablet 10"', prefix: "TAB10", description: "10-inch COD tablets",
    config: {
      identifier: "imei", hasSim: true, hasOs: true, uniqueName: true, labels: { deviceName: "Device Name / Code" },
      extraFields: [
        { key: "deviceCode", label: "Device Code (#)", type: "text" },
        { key: "chargerStatus", label: "Charger Status", type: "select", options: ["With charger", "Without charger", "Unknown"] },
        { key: "accessories", label: "Accessories", type: "text" },
        { key: "deploymentLocation", label: "Deployment Location", type: "text" },
      ],
    },
  },
  {
    name: "PC", prefix: "PC", description: "Desktop computers",
    config: { identifier: "serial", hasOs: true, uniqueName: true, labels: { deviceName: "PC Name" }, extraFields: [{ key: "monitors", label: "Number of Monitors", type: "number" }] },
  },
  {
    name: "VHF", prefix: "VHF", description: "VHF handheld radios",
    config: { identifier: "serial", labels: { deviceName: "Local Code", inventoryNumber: "MPL Code", shift: "Unit / Shift" }, extraFields: [] },
  },
];

const STATUS_META: Record<string, { code: StatusCode; color: string }> = {
  "in use": { code: "IN_USE", color: "green" },
  "in stock": { code: "IN_STOCK", color: "blue" },
  "under repair": { code: "UNDER_REPAIR", color: "orange" },
  damaged: { code: "DAMAGED", color: "red" },
  unverified: { code: "UNVERIFIED", color: "purple" },
  "not in use": { code: "NOT_IN_USE", color: "yellow" },
  disposed: { code: "DISPOSED", color: "gray" },
  lost: { code: "LOST", color: "dark" },
};

const LOCATION_ALIASES: Record<string, string[]> = {
  "Container Yard": ["C-Yard", "C Yard", "CY", "C.Yard"],
  "POD Office": ["POD-Office"],
  "Gear Store": ["Gear"],
};

const LOOKUPS: Record<LookupCategory, string[]> = {
  CONDITION: ["Good", "Fair", "Damaged", "Critical"],
  DEPARTMENT: ["Container Operations", "Port Operations", "IT", "Marine", "Security"],
  SHIFT: ["A Shift", "B Shift", "C Shift", "General"],
  SIM_OPERATOR: [],
  BRAND: ["Motorola", "Vertex Standard", "Samsung", "Lenovo", "HP", "Dell"],
};

async function readLists(): Promise<{ locations: string[]; statuses: string[]; sims: string[] }> {
  const fallback = {
    locations: ["COD", "Container Yard", "Thilafushi", "HMT", "Marine Craft", "Yard Office", "IT", "POD-MCH", "POD-HMT", "POD Office", "Gear Store"],
    statuses: ["In Use", "In Stock", "Under Repair", "Damaged", "Unverified", "Not in Use", "Disposed", "Lost"],
    sims: ["Dhiraagu 10GB", "Dhiraagu 20GB", "Ooredoo 10GB"],
  };
  if (!fs.existsSync(WORKBOOK)) return fallback;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK);
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === "lists");
  if (!ws) return fallback;
  const header = (ws.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const collect = (c: number) => {
    const out: string[] = [];
    if (c < 1) return out;
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const v = row.getCell(c).value;
      const s = v == null ? "" : String(v).trim();
      if (s && !/^add new values/i.test(s) && s.toLowerCase() !== "none") out.push(s);
    });
    return out;
  };
  return {
    locations: collect(col("location")),
    statuses: collect(col("status")),
    sims: collect(col("sim operator")),
  };
}

async function seedReference() {
  const lists = await readLists();
  for (const [i, t] of ASSET_TYPES.entries()) {
    await prisma.assetType.upsert({
      where: { prefix: t.prefix },
      create: { ...t, sortOrder: i, config: t.config as object },
      update: {},
    });
  }
  for (const [i, name] of lists.statuses.entries()) {
    const meta = STATUS_META[name.toLowerCase()] ?? { code: "CUSTOM" as StatusCode, color: "gray" };
    await prisma.status.upsert({ where: { name }, create: { name, code: meta.code, color: meta.color, sortOrder: i }, update: {} });
  }
  // Ensure every system status code has a status (business rules depend on them)
  for (const [lower, meta] of Object.entries(STATUS_META)) {
    const exists = await prisma.status.findFirst({ where: { code: meta.code } });
    if (!exists) {
      const name = lower.replace(/\b\w/g, (c) => c.toUpperCase());
      await prisma.status.create({ data: { name, code: meta.code, color: meta.color, sortOrder: 50 } });
    }
  }
  for (const [i, name] of lists.locations.entries()) {
    await prisma.location.upsert({ where: { name }, create: { name, sortOrder: i, aliases: LOCATION_ALIASES[name] ?? [] }, update: {} });
  }
  const lookups = { ...LOOKUPS, SIM_OPERATOR: lists.sims };
  for (const [category, values] of Object.entries(lookups) as [LookupCategory, string[]][]) {
    for (const [i, value] of values.entries()) {
      await prisma.lookupValue.upsert({
        where: { category_value: { category, value } },
        create: { category, value, sortOrder: i },
        update: {},
      });
    }
  }
  const existing = await prisma.setting.count();
  if (!existing) await saveSettings(DEFAULT_SETTINGS);
  console.log(`✔ Reference data: ${ASSET_TYPES.length} types, ${lists.statuses.length} statuses, ${lists.locations.length} locations`);
}

async function seedUsers() {
  const users: { name: string; email: string; username: string; role: Role; password: string }[] = [
    {
      name: process.env.SEED_ADMIN_NAME || "System Administrator",
      email: process.env.SEED_ADMIN_EMAIL || "admin@mpl.mv",
      username: "admin",
      role: "ADMIN",
      password: process.env.SEED_ADMIN_PASSWORD || "Admin@12345",
    },
  ];
  if (process.env.SEED_DEMO_USERS !== "false") {
    const pw = process.env.SEED_DEMO_PASSWORD || "Demo@12345";
    users.push(
      { name: "Inventory Officer", email: "officer@mpl.mv", username: "officer", role: "INVENTORY_OFFICER", password: pw },
      { name: "Operations User", email: "ops@mpl.mv", username: "ops", role: "OPERATIONS_USER", password: pw },
      { name: "Read-only Viewer", email: "viewer@mpl.mv", username: "viewer", role: "VIEWER", password: pw },
    );
  }
  for (const u of users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) continue;
    await prisma.user.create({ data: { name: u.name, email: u.email, username: u.username, role: u.role, passwordHash: await hashPassword(u.password) } });
    console.log(`✔ User ${u.email} (${u.role})`);
  }
}

async function seedAssets() {
  const count = await prisma.asset.count();
  if (count > 0) {
    console.log(`• ${count} assets already present — skipping workbook import`);
    return;
  }
  if (!fs.existsSync(WORKBOOK)) {
    console.log(`• Workbook not found at ${WORKBOOK} — skipping data migration`);
    return;
  }
  const buf = fs.readFileSync(WORKBOOK);
  const staged = await parseWorkbook(buf, path.basename(WORKBOOK), await loadImportContext());
  const include = new Set([...staged.rows, ...staged.movements].filter((r) => r.include).map((r) => r.key));
  const result = await commitImport(staged, include, null);
  console.log("✔ Workbook migrated:", JSON.stringify({ byType: staged.summary.byType, issues: staged.summary.issueCounts, ...result }, null, 0));
}

async function main() {
  await seedReference();
  await seedUsers();
  await seedAssets();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
