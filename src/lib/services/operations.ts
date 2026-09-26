import type { MovementAction, Prisma, StatusCode } from "@prisma/client";
import type { z } from "zod";
import { prisma, type Tx } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/action";
import { addDays, parseISODate, formatDate } from "@/lib/utils";
import { ACTION_LABELS } from "@/lib/constants";
import { operationBlockedReason, type OperationKey } from "@/lib/operation-rules";
import type {
  issueSchema, transferSchema, returnSchema, disposeSchema, lostSchema, statusChangeSchema,
  repairOutSchema, repairInSchema, damageSchema, verifySchema, osUpdateSchema, requestSchema,
} from "@/lib/validation/schemas";
import { ASSET_INCLUDE, applyAssetChange, statusByCode, type AssetWithRefs } from "./assets";
import { getSettings } from "./settings";
import { notify } from "./notifications";
import { auditEvent } from "./audit";

/*
 * Every operation below follows the same pattern, inside ONE transaction:
 *   1. load the asset and check the business rule for its current status
 *   2. write the permanent history record (movement / repair / verification / damage)
 *   3. update the asset register's current state via applyAssetChange (→ audit trail)
 *   4. raise notifications
 * The Asset Register is therefore always the current state; history is append-only.
 */

type Ctx = { tx: Tx; user: CurrentUser };

async function loadAsset(tx: Tx, id: string) {
  const a = await tx.asset.findFirst({ where: { OR: [{ id }, { assetId: id }] }, include: ASSET_INCLUDE });
  if (!a) throw new DomainError("Asset not found. Movements can only be recorded for registered assets.");
  if (a.archived) throw new DomainError(`${a.assetId} is archived. Restore it before recording movements.`);
  return a;
}

function assertAllowed(a: AssetWithRefs, op: OperationKey) {
  const reason = operationBlockedReason(op, a.status, a.assetId);
  if (reason) throw new DomainError(reason);
}

async function locationName(tx: Tx, id?: string | null) {
  if (!id) return null;
  const l = await tx.location.findUnique({ where: { id } });
  if (!l) throw new DomainError("Unknown location");
  return l;
}

async function writeMovement(
  { tx, user }: Ctx,
  a: AssetWithRefs,
  after: AssetWithRefs,
  action: MovementAction,
  input: { date: string; doneBy?: string | null; notes?: string | null; reason?: string | null },
  extra: Partial<Prisma.MovementUncheckedCreateInput> = {},
) {
  return tx.movement.create({
    data: {
      assetId: a.id,
      action,
      date: parseISODate(input.date)!,
      fromLocation: a.location?.name ?? null,
      toLocation: after.location?.name ?? null,
      fromAssignee: a.assignedTo,
      assignedTo: after.assignedTo,
      staffId: after.staffId,
      shift: after.shift,
      statusBefore: a.status.name,
      statusAfter: after.status.name,
      doneBy: input.doneBy || user.name,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      recordedById: user.id,
      ...extra,
    },
  });
}

/** Resolve an active staff member for an issue / transfer. */
async function loadStaff(tx: Tx, staffId?: string | null) {
  if (!staffId) return null;
  const s = await tx.staff.findUnique({ where: { id: staffId } });
  if (!s) throw new DomainError("Staff member not found.");
  if (!s.active) throw new DomainError(`${s.name} is deactivated and cannot receive devices.`);
  return s;
}

async function closeRequest(ctx: Ctx, requestId?: string | null) {
  if (!requestId) return;
  await ctx.tx.assetRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", reviewedById: ctx.user.id, reviewedAt: new Date() },
  });
}

async function movementNotice(ctx: Ctx, a: AssetWithRefs, action: MovementAction, text: string, severity: "info" | "warning" | "critical" | "success" = "info") {
  await notify(ctx.tx, {
    type: `movement_${action.toLowerCase()}`,
    severity,
    title: `${ACTION_LABELS[action]} · ${a.assetId}`,
    message: text,
    link: `/assets/${encodeURIComponent(a.assetId)}`,
  });
}

function run<T>(user: CurrentUser, fn: (ctx: Ctx) => Promise<T>) {
  return prisma.$transaction((tx) => fn({ tx, user }), { timeout: 20_000 });
}

// ── Issue / Transfer / Return ─────────────────────────────────

export function issueAsset(input: z.infer<typeof issueSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "ISSUE");
    const to = await locationName(ctx.tx, input.toLocationId);
    const inUse = await statusByCode(ctx.tx, "IN_USE");
    const staff = await loadStaff(ctx.tx, input.staffId);
    const assignee = staff ? staff.name : input.assignedTo!;
    const { after } = await applyAssetChange(ctx.tx, user, a.id, {
      locationId: to!.id,
      assignedTo: assignee,
      staffId: staff?.id ?? null,
      shift: input.shift ?? staff?.shift ?? a.shift,
      department: input.department ?? a.department,
      statusId: inUse.id,
      issuedDate: parseISODate(input.date),
    }, "ISSUE");
    const m = await writeMovement(ctx, a, after, "ISSUE", input);
    await closeRequest(ctx, input.requestId);
    await movementNotice(ctx, a, "ISSUE", `${a.assetId} issued to ${assignee}${staff ? ` (${staff.employeeNumber})` : ""} at ${to!.name}.`);
    return { movementId: m.id, assetId: a.assetId };
  });
}

export function transferAsset(input: z.infer<typeof transferSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "TRANSFER");
    const to = await locationName(ctx.tx, input.toLocationId);
    const staff = await loadStaff(ctx.tx, input.staffId);
    // New holder: a staff member, else free-text assignee, else unchanged
    const newAssignee = staff ? staff.name : input.assignedTo ?? a.assignedTo;
    const newStaffId = staff ? staff.id : input.assignedTo ? null : a.staffId;
    if (to!.id === a.locationId && (newAssignee ?? "") === (a.assignedTo ?? "") && newStaffId === a.staffId) {
      throw new DomainError("Choose a different location or assignee — nothing would change.");
    }
    const { after } = await applyAssetChange(ctx.tx, user, a.id, {
      locationId: to!.id,
      assignedTo: newAssignee,
      staffId: newStaffId,
      shift: input.shift ?? (staff?.shift || a.shift),
    }, "TRANSFER");
    const m = await writeMovement(ctx, a, after, "TRANSFER", input);
    await closeRequest(ctx, input.requestId);
    await movementNotice(ctx, a, "TRANSFER", `${a.assetId} transferred from ${a.location?.name ?? "—"} to ${to!.name}.`);
    return { movementId: m.id, assetId: a.assetId };
  });
}

export function returnAsset(input: z.infer<typeof returnSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "RETURN");
    const to = await locationName(ctx.tx, input.toLocationId);
    const damaged = input.condition && /damag|critical/i.test(input.condition);
    const status = await statusByCode(ctx.tx, damaged ? "DAMAGED" : "IN_STOCK");
    const { after } = await applyAssetChange(ctx.tx, user, a.id, {
      locationId: to!.id,
      assignedTo: null,
      staffId: null,
      shift: null,
      statusId: status.id,
      condition: input.condition ?? a.condition,
    }, "RETURN");
    const notes = [input.returnedBy ? `Returned by ${input.returnedBy}` : null, input.notes].filter(Boolean).join(" — ") || null;
    // The movement records who returned it (the previous holder)
    const m = await writeMovement(ctx, a, after, "RETURN", { ...input, notes }, { staffId: a.staffId });
    await closeRequest(ctx, input.requestId);
    await movementNotice(ctx, a, "RETURN", `${a.assetId} returned to ${to!.name}${damaged ? " (damaged)" : ""}.`);
    return { movementId: m.id, assetId: a.assetId };
  });
}

// ── Dispose / Lost / Status change ────────────────────────────

export function disposeAsset(input: z.infer<typeof disposeSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "DISPOSE");
    const s = await statusByCode(ctx.tx, "DISPOSED");
    const { after } = await applyAssetChange(ctx.tx, user, a.id, { statusId: s.id, assignedTo: null, staffId: null }, "DISPOSE");
    const m = await writeMovement(ctx, a, after, "DISPOSE", input);
    await movementNotice(ctx, a, "DISPOSE", `${a.assetId} disposed. Reason: ${input.reason}`, "warning");
    return { movementId: m.id, assetId: a.assetId };
  });
}

export function markLost(input: z.infer<typeof lostSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "MARK_LOST");
    const s = await statusByCode(ctx.tx, "LOST");
    const { after } = await applyAssetChange(ctx.tx, user, a.id, { statusId: s.id }, "MARK_LOST");
    const m = await writeMovement(ctx, a, after, "MARK_LOST", input);
    await notify(ctx.tx, {
      type: "asset_lost",
      severity: "critical",
      title: `Lost asset reported · ${a.assetId}`,
      message: `${a.assetId} (${a.deviceName ?? a.assetType.name}) marked lost. Reason: ${input.reason}`,
      link: `/assets/${encodeURIComponent(a.assetId)}`,
      audience: ["ADMIN", "INVENTORY_OFFICER", "OPERATIONS_USER"],
    });
    return { movementId: m.id, assetId: a.assetId };
  });
}

export function changeStatus(input: z.infer<typeof statusChangeSchema>, user: CurrentUser, tx?: Tx) {
  const body = async (ctx: Ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    const s = await ctx.tx.status.findUnique({ where: { id: input.statusId } });
    if (!s) throw new DomainError("Unknown status");
    if (s.id === a.statusId) return null;
    if (s.code === "UNDER_REPAIR") throw new DomainError("Use 'Send for Repair' to put an asset under repair.");
    if (s.code === "LOST" && !input.reason) throw new DomainError("A reason is required to mark an asset as lost.");
    if (a.status.code === "UNDER_REPAIR") throw new DomainError(`${a.assetId} is under repair — record 'Repair In' first.`);
    const { after } = await applyAssetChange(ctx.tx, user, a.id, { statusId: s.id }, "STATUS_CHANGE");
    return writeMovement(ctx, a, after, "STATUS_CHANGE", input);
  };
  return tx ? body({ tx, user }) : run(user, body);
}

// ── Repairs ───────────────────────────────────────────────────

export function repairOut(input: z.infer<typeof repairOutSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "REPAIR_OUT");
    const s = await statusByCode(ctx.tx, "UNDER_REPAIR");
    const repair = await ctx.tx.repair.create({
      data: {
        assetId: a.id,
        status: "OPEN",
        repairOutDate: parseISODate(input.date),
        reportedProblem: input.reportedProblem,
        conditionOut: input.condition ?? a.condition,
        sentBy: input.sentBy || user.name,
        technician: input.technician,
        expectedReturnDate: parseISODate(input.expectedReturnDate),
        statusBefore: a.status.code,
        notes: input.notes,
      },
    });
    const { after } = await applyAssetChange(ctx.tx, user, a.id, { statusId: s.id, condition: input.condition ?? a.condition }, "REPAIR_OUT");
    await writeMovement(ctx, a, after, "REPAIR_OUT", { ...input, doneBy: input.sentBy, reason: input.reportedProblem }, { toLocation: input.technician ? `Repair: ${input.technician}` : "Repair" });
    await closeRequest(ctx, input.requestId);
    await movementNotice(ctx, a, "REPAIR_OUT", `${a.assetId} sent for repair: ${input.reportedProblem}`, "warning");
    return { repairId: repair.id, assetId: a.assetId };
  });
}

export function repairIn(input: z.infer<typeof repairInSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "REPAIR_IN");
    const open = await ctx.tx.repair.findFirst({ where: { assetId: a.id, status: "OPEN" }, orderBy: { createdAt: "desc" } });

    // Status after repair: explicit choice, else previous status (or In Stock), else Damaged if not repaired
    let statusAfterId = input.statusAfterId;
    if (!statusAfterId) {
      let code: StatusCode = "IN_STOCK";
      if (!input.repairCompleted) code = "DAMAGED";
      else if (open?.statusBefore === "IN_USE") code = "IN_USE";
      statusAfterId = (await statusByCode(ctx.tx, code)).id;
    }
    const to = input.toLocationId ? await locationName(ctx.tx, input.toLocationId) : null;
    const repairData = {
      status: input.repairCompleted ? ("COMPLETED" as const) : ("NOT_REPAIRABLE" as const),
      repairInDate: parseISODate(input.date),
      repairDescription: input.repairDescription,
      partsReplaced: input.partsReplaced,
      cost: input.cost ?? undefined,
      technician: input.technician ?? open?.technician,
      conditionAfter: input.conditionAfter,
      notes: [open?.notes, input.notes].filter(Boolean).join("\n") || null,
    };
    const repair = open
      ? await ctx.tx.repair.update({ where: { id: open.id }, data: repairData })
      : await ctx.tx.repair.create({ data: { ...repairData, assetId: a.id, reportedProblem: "(repair-out not recorded)" } });

    const { after } = await applyAssetChange(ctx.tx, user, a.id, {
      statusId: statusAfterId,
      condition: input.conditionAfter ?? a.condition,
      lastServiceDate: parseISODate(input.date),
      ...(to ? { locationId: to.id } : {}),
    }, "REPAIR_IN");
    await writeMovement(ctx, a, after, "REPAIR_IN", { ...input, reason: input.repairDescription }, {
      fromLocation: repair.technician ? `Repair: ${repair.technician}` : "Repair",
    });
    await closeRequest(ctx, input.requestId);
    await movementNotice(
      ctx, a, "REPAIR_IN",
      input.repairCompleted ? `${a.assetId} returned from repair (${after.status.name}).` : `${a.assetId} returned — not repairable.`,
      input.repairCompleted ? "success" : "warning",
    );
    return { repairId: repair.id, assetId: a.assetId };
  });
}

// ── Damage ────────────────────────────────────────────────────

export function reportDamage(
  input: z.infer<typeof damageSchema>,
  user: CurrentUser,
  files: { name: string; type: string; data: Buffer }[] = [],
) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "MARK_DAMAGED");
    const report = await ctx.tx.damageReport.create({
      data: {
        assetId: a.id,
        date: parseISODate(input.date)!,
        description: input.description,
        severity: input.severity,
        reportedBy: input.reportedBy || user.name,
        location: input.location ?? a.location?.name,
        notes: input.notes,
      },
    });
    for (const f of files) {
      await ctx.tx.attachment.create({
        data: { assetId: a.id, damageReportId: report.id, fileName: f.name, mimeType: f.type, size: f.data.length, data: new Uint8Array(f.data), uploadedBy: user.name },
      });
    }
    // An asset under repair stays Under Repair; otherwise it becomes Damaged
    const s = a.status.code === "UNDER_REPAIR" ? a.status : await statusByCode(ctx.tx, "DAMAGED");
    const { after } = await applyAssetChange(ctx.tx, user, a.id, {
      statusId: s.id,
      condition: input.severity === "CRITICAL" ? "Critical" : "Damaged",
    }, "MARK_DAMAGED");
    await writeMovement(ctx, a, after, "MARK_DAMAGED", { ...input, doneBy: input.reportedBy, reason: `${input.severity}: ${input.description}` });
    await notify(ctx.tx, {
      type: "damage_reported",
      severity: input.severity === "MINOR" ? "warning" : "critical",
      title: `Damage reported · ${a.assetId}`,
      message: `${input.severity.toLowerCase()} damage: ${input.description}`,
      link: `/assets/${encodeURIComponent(a.assetId)}`,
    });
    return { damageReportId: report.id, assetId: a.assetId };
  });
}

// ── Verification ─────────────────────────────────────────────

export function verifyAsset(input: z.infer<typeof verifySchema>, user: CurrentUser, txIn?: Tx) {
  const body = async (ctx: Ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "VERIFY");
    const settings = await getSettings(ctx.tx);
    const date = parseISODate(input.date)!;
    const loc = input.physicalLocationId ? await locationName(ctx.tx, input.physicalLocationId) : null;

    await ctx.tx.verification.create({
      data: {
        assetId: a.id,
        verificationDate: date,
        physicalLocation: loc?.name ?? a.location?.name,
        assignedUser: input.assignedUser ?? a.assignedTo,
        devicePresent: input.devicePresent,
        serialConfirmed: input.serialConfirmed,
        assetNumberConfirmed: input.assetNumberConfirmed,
        locationMatches: input.locationMatches,
        assignmentMatches: input.assignmentMatches,
        conditionChecked: input.conditionChecked,
        condition: input.condition ?? a.condition,
        result: input.result,
        verifiedBy: input.doneBy || user.name,
        remarks: input.notes,
      },
    });

    const patch: Prisma.AssetUncheckedUpdateInput = {};
    if (input.result === "NOT_FOUND") {
      patch.statusId = input.statusAfterId ?? (await statusByCode(ctx.tx, "LOST")).id;
    } else {
      patch.lastVerificationDate = date;
      patch.nextVerificationDate = addDays(date, settings.verificationIntervalDays);
      if (input.condition) patch.condition = input.condition;
      if (input.updateRegister) {
        if (loc && loc.id !== a.locationId) patch.locationId = loc.id;
        if (input.assignedUser && input.assignedUser !== a.assignedTo) {
          patch.assignedTo = input.assignedUser;
          patch.staffId = null;
        }
      }
      if (input.statusAfterId) patch.statusId = input.statusAfterId;
      else if (a.status.code === "UNVERIFIED") {
        const assigned = (patch.assignedTo as string | undefined) ?? a.assignedTo;
        patch.statusId = (await statusByCode(ctx.tx, assigned ? "IN_USE" : "IN_STOCK")).id;
      }
    }
    const { after } = await applyAssetChange(ctx.tx, user, a.id, patch, "VERIFIED");
    await writeMovement(ctx, a, after, "VERIFIED", {
      ...input,
      reason: input.result === "VERIFIED" ? "Verified OK" : input.result === "DISCREPANCY" ? "Verified with discrepancy" : "Not found at verification",
    });
    if (input.result === "NOT_FOUND") {
      await notify(ctx.tx, {
        type: "asset_lost",
        severity: "critical",
        title: `Asset not found · ${a.assetId}`,
        message: `${a.assetId} could not be found during verification on ${formatDate(date)}.`,
        link: `/assets/${encodeURIComponent(a.assetId)}`,
      });
    }
    return { assetId: a.assetId };
  };
  return txIn ? body({ tx: txIn, user }) : run(user, body);
}

/** Bulk verification from the register (all checks confirmed, result = Verified OK). */
export async function bulkVerify(ids: string[], date: string, notes: string | null, user: CurrentUser) {
  let done = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      await run(user, (ctx) =>
        verifyAsset({
          assetId: id, date, notes: notes ?? "Bulk verification", doneBy: user.name, requestId: null,
          physicalLocationId: null, assignedUser: null, condition: null,
          devicePresent: true, serialConfirmed: true, assetNumberConfirmed: true, locationMatches: true, assignmentMatches: true, conditionChecked: true,
          result: "VERIFIED", statusAfterId: null, updateRegister: false,
        }, user, ctx.tx),
      );
      done++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { done, errors };
}

export async function bulkStatus(ids: string[], statusId: string, reason: string | null, user: CurrentUser, date: string) {
  let done = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      await changeStatus({ assetId: id, statusId, reason, date, doneBy: user.name, notes: "Bulk status update", requestId: null }, user);
      done++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { done, errors };
}

// ── OS updates ───────────────────────────────────────────────

export function recordOsUpdate(input: z.infer<typeof osUpdateSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    assertAllowed(a, "OS_UPDATE");
    const date = parseISODate(input.date)!;
    await ctx.tx.osUpdate.create({
      data: { assetId: a.id, updateDate: date, osVersion: input.osVersion, updatedBy: input.doneBy || user.name, notes: input.notes },
    });
    const newer = !a.lastOsUpdate || a.lastOsUpdate.getTime() <= date.getTime();
    const { after } = await applyAssetChange(ctx.tx, user, a.id, newer ? { lastOsUpdate: date, osVersion: input.osVersion ?? a.osVersion } : {}, "OS_UPDATE");
    await writeMovement(ctx, a, after, "OS_UPDATE", { ...input, reason: input.osVersion ? `OS ${input.osVersion}` : null });
    return { assetId: a.assetId };
  });
}

// ── Requests (Operations Users) ──────────────────────────────

export function createRequest(input: z.infer<typeof requestSchema>, user: CurrentUser) {
  return run(user, async (ctx) => {
    const a = await loadAsset(ctx.tx, input.assetId);
    const pending = await ctx.tx.assetRequest.findFirst({ where: { assetId: a.id, status: "PENDING", type: input.type } });
    if (pending) throw new DomainError(`A ${input.type.toLowerCase()} request for ${a.assetId} is already pending.`);
    const req = await ctx.tx.assetRequest.create({
      data: {
        type: input.type,
        assetId: a.id,
        requestedById: user.id,
        notes: input.notes,
        payload: { toLocationId: input.toLocationId, staffId: input.staffId, assignedTo: input.assignedTo, shift: input.shift, problem: input.problem },
      },
    });
    await auditEvent(ctx.tx, user, { entityType: "Request", entityId: req.id, action: "REQUEST", asset: a, message: `${input.type.toLowerCase()} request raised for ${a.assetId}` });
    await notify(ctx.tx, {
      type: "request",
      severity: input.type === "REPAIR" ? "warning" : "info",
      title: `${input.type === "REPAIR" ? "Repair" : "Movement"} request · ${a.assetId}`,
      message: `${user.name} requested ${input.type.toLowerCase()} for ${a.assetId}${input.problem ? `: ${input.problem}` : ""}.`,
      link: "/movements?tab=requests",
    });
    return { requestId: req.id };
  });
}

export async function rejectRequest(requestId: string, note: string | null, user: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.assetRequest.findUnique({ where: { id: requestId }, include: { asset: true } });
    if (!r || r.status !== "PENDING") throw new DomainError("Request is no longer pending.");
    await tx.assetRequest.update({ where: { id: requestId }, data: { status: "REJECTED", reviewNote: note, reviewedById: user.id, reviewedAt: new Date() } });
    await auditEvent(tx, user, { entityType: "Request", entityId: r.id, action: "REJECT", asset: r.asset, message: `${r.type.toLowerCase()} request for ${r.asset.assetId} rejected${note ? `: ${note}` : ""}` });
  });
}
