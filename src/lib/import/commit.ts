import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseTypeConfig } from "@/lib/asset-type-config";
import type { CurrentUser } from "@/lib/auth/session";
import { addDays, parseISODate } from "@/lib/utils";
import { getSettings } from "@/lib/services/settings";
import { auditEvent } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import type { ImportContext } from "./parse";
import { ISSUE_META, type StagedImport, type StagedRow } from "./types";

export async function loadImportContext(): Promise<ImportContext> {
  const [types, locations, statuses, lookups, existing] = await Promise.all([
    prisma.assetType.findMany(),
    prisma.location.findMany(),
    prisma.status.findMany(),
    prisma.lookupValue.findMany(),
    prisma.asset.findMany({ select: { assetId: true, serialNumber: true, imei: true } }),
  ]);
  return {
    types: types.map((t) => ({ name: t.name, prefix: t.prefix, config: parseTypeConfig(t.config) })),
    locations: locations.map((l) => ({ name: l.name, aliases: l.aliases })),
    statuses: statuses.map((s) => s.name),
    brands: lookups.filter((l) => l.category === "BRAND").map((l) => l.value),
    simOperators: lookups.filter((l) => l.category === "SIM_OPERATOR").map((l) => l.value),
    existing,
  };
}

/** Rows with warnings are imported but flagged "needs review" on the asset. */
function reviewNotes(r: StagedRow): string | null {
  const w = r.issues.filter((i) => ISSUE_META[i.code].severity === "warning");
  return w.length ? w.map((i) => `${ISSUE_META[i.code].label}: ${i.message}`).join("\n") : null;
}

export type CommitResult = {
  assetsCreated: number;
  flaggedForReview: number;
  repairsCreated: number;
  movementsCreated: number;
  locationsCreated: string[];
  statusesCreated: string[];
  skipped: number;
};

/**
 * Write the selected staged rows. All-or-nothing: runs in a single transaction.
 * Original cell values are kept in assets.legacy_data; remarks are kept verbatim.
 */
export async function commitImport(staged: StagedImport, includeKeys: Set<string>, user: CurrentUser | null): Promise<CommitResult> {
  const settings = await getSettings();
  return prisma.$transaction(
    async (tx) => {
      const result: CommitResult = { assetsCreated: 0, flaggedForReview: 0, repairsCreated: 0, movementsCreated: 0, locationsCreated: [], statusesCreated: [], skipped: 0 };
      const types = await tx.assetType.findMany();
      const typeByName = new Map(types.map((t) => [t.name, t]));

      // Reference additions from the Lists sheet
      const add = staged.summary.referenceAdditions;
      for (const s of add.statuses) {
        await tx.status.upsert({ where: { name: s }, create: { name: s, code: "CUSTOM", color: "gray", sortOrder: 90 }, update: {} });
        result.statusesCreated.push(s);
      }
      for (const v of add.simOperators) {
        await tx.lookupValue.upsert({ where: { category_value: { category: "SIM_OPERATOR", value: v } }, create: { category: "SIM_OPERATOR", value: v }, update: {} });
      }

      const locations = new Map((await tx.location.findMany()).map((l) => [l.name.toLowerCase(), l]));
      const ensureLocation = async (name: string | null) => {
        if (!name) return null;
        const hit = locations.get(name.toLowerCase());
        if (hit) return hit.id;
        const created = await tx.location.create({ data: { name, sortOrder: 100 + locations.size, description: "Created by Excel import" } });
        locations.set(name.toLowerCase(), created);
        result.locationsCreated.push(name);
        return created.id;
      };
      for (const l of add.locations) await ensureLocation(l);

      const statuses = new Map((await tx.status.findMany()).map((s) => [s.name.toLowerCase(), s]));
      const unverified = [...statuses.values()].find((s) => s.code === "UNVERIFIED")!;

      // Asset ID counters per prefix (DB + file)
      const counters = new Map<string, number>();
      const allIds = [
        ...(await tx.asset.findMany({ select: { assetId: true } })).map((a) => a.assetId),
        ...staged.rows.map((r) => r.data.assetId).filter(Boolean) as string[],
      ];
      for (const id of allIds) {
        const m = /^(.+)-(\d+)$/.exec(id);
        if (m) counters.set(m[1], Math.max(counters.get(m[1]) ?? 0, Number(m[2])));
      }
      const genId = (prefix: string) => {
        const n = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, n);
        return `${prefix}-${String(n).padStart(3, "0")}`;
      };

      const createdIds = new Map<string, string>(); // asset code → db id
      for (const r of staged.rows) {
        if (!includeKeys.has(r.key) || r.issues.some((i) => ISSUE_META[i.code].severity === "error" && i.code !== "EXISTS_IN_DB")) {
          result.skipped++;
          continue;
        }
        if (r.issues.some((i) => i.code === "EXISTS_IN_DB")) {
          result.skipped++;
          continue;
        }
        const d = r.data;
        const type = typeByName.get(d.typeName);
        if (!type) {
          result.skipped++;
          continue;
        }
        const assetId = d.assetId ?? genId(type.prefix);
        const locationId = await ensureLocation(d.locationName);
        const status = statuses.get(d.statusName.toLowerCase()) ?? unverified;
        const lastVerified = parseISODate(d.lastVerified);
        const notes = reviewNotes(r);
        const data: Prisma.AssetUncheckedCreateInput = {
          assetId,
          assetTypeId: type.id,
          deviceName: d.deviceName,
          brand: d.brand,
          model: d.model,
          serialNumber: d.serialNumber,
          imei: d.imei,
          inventoryNumber: d.inventoryNumber,
          assetNumber: d.assetNumber,
          alternateReference: d.alternateReference,
          simOperator: d.simOperator,
          simNumber: d.simNumber,
          locationId,
          assignedTo: d.assignedTo,
          shift: d.shift,
          statusId: status.id,
          condition: d.condition,
          issuedDate: parseISODate(d.issuedDate),
          receivedDate: parseISODate(d.receivedDate),
          lastOsUpdate: parseISODate(d.lastOsUpdate),
          lastVerificationDate: lastVerified,
          nextVerificationDate: lastVerified ? addDays(lastVerified, settings.verificationIntervalDays) : null,
          remarks: d.remarks,
          attributes: d.attributes,
          needsReview: !!notes,
          reviewNotes: notes,
          source: "IMPORT",
          sourceRef: r.sourceRef,
          legacyData: { register: r.raw, legacySheets: r.legacy, locationAsRecorded: d.locationRaw } as Prisma.InputJsonValue,
        };
        const asset = await tx.asset.create({ data });
        createdIds.set(assetId.toUpperCase(), asset.id);
        result.assetsCreated++;
        if (notes) result.flaggedForReview++;

        for (const rep of d.repairs) {
          await tx.repair.create({
            data: {
              assetId: asset.id, status: "COMPLETED", source: "IMPORT",
              repairInDate: parseISODate(rep.date), repairOutDate: parseISODate(rep.date),
              reportedProblem: "(from legacy repair history)", repairDescription: rep.text,
              notes: `Imported from ${r.sourceRef}`,
            },
          });
          result.repairsCreated++;
        }
        // Excel says "Under Repair" but has no repair-out record: open a repair case so "Repair In" can close it
        if (status.code === "UNDER_REPAIR") {
          await tx.repair.create({
            data: {
              assetId: asset.id, status: "OPEN", source: "IMPORT", statusBefore: "IN_USE",
              reportedProblem: d.remarks ? `(from Excel) ${d.remarks}` : "(status Under Repair in Excel — details not recorded)",
              notes: `Imported from ${r.sourceRef}`,
            },
          });
          result.repairsCreated++;
        }
        if (d.issuedDate) {
          await tx.movement.create({
            data: {
              assetId: asset.id, action: "ISSUE", date: parseISODate(d.issuedDate)!, toLocation: d.locationName,
              assignedTo: d.assignedTo, statusAfter: status.name, source: "IMPORT", doneBy: null,
              notes: `Imported from Excel (Issued Date, ${r.sourceRef})`, recordedById: user?.id,
            },
          });
          result.movementsCreated++;
        }
        await tx.auditLog.create({
          data: {
            userId: user?.id, userName: user?.name ?? "System (seed)", assetId: asset.id, assetCode: assetId, entityType: "Asset", entityId: asset.id,
            action: "IMPORT", message: `Asset ${assetId} imported from ${r.sourceRef}${notes ? " (flagged for review)" : ""}`,
          },
        });
      }

      // Movement Log rows
      for (const m of staged.movements) {
        if (!includeKeys.has(m.key) || m.issues.length) continue;
        const dbId = createdIds.get(m.assetId.toUpperCase()) ?? (await tx.asset.findUnique({ where: { assetId: m.assetId }, select: { id: true } }))?.id;
        if (!dbId) continue;
        await tx.movement.create({
          data: {
            assetId: dbId, action: m.action as never, date: parseISODate(m.date)!, fromLocation: m.from, toLocation: m.to,
            assignedTo: m.assignedTo, doneBy: m.doneBy, notes: m.notes, source: "IMPORT", recordedById: user?.id,
          },
        });
        result.movementsCreated++;
      }

      await auditEvent(tx, user, {
        entityType: "Import",
        action: "IMPORT",
        message: `Excel import "${staged.summary.fileName}": ${result.assetsCreated} assets created (${result.flaggedForReview} flagged for review), ${result.repairsCreated} repair records, ${result.movementsCreated} movements, ${result.skipped} rows skipped`,
      });
      if (result.flaggedForReview) {
        await notify(tx, {
          type: "import_review",
          severity: "warning",
          title: "Imported records need review",
          message: `${result.flaggedForReview} imported assets were flagged for manual review.`,
          link: "/assets?review=1",
          audience: ["ADMIN", "INVENTORY_OFFICER"],
        });
      }
      return result;
    },
    { timeout: 180_000, maxWait: 20_000 },
  );
}
