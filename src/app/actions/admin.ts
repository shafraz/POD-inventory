"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineAction, DomainError } from "@/lib/action";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { auditEvent } from "@/lib/services/audit";
import { saveSettings, getSettings } from "@/lib/services/settings";
import { markRead } from "@/lib/services/notifications";
import { getCurrentUser } from "@/lib/auth/session";
import { reqStr } from "@/lib/validation/schemas";
import { saveUserSchema, saveLocationSchema, saveAssetTypeSchema, saveStatusSchema, saveSettingsSchema } from "@/lib/validation/admin-schemas";

const refresh = () => revalidatePath("/", "layout");

// ── Users ────────────────────────────────────────────────────


export const saveUserAction = defineAction(
  "users.manage",
  saveUserSchema,
  async (input, me) => {
    if (input.password) {
      const err = passwordPolicyError(input.password);
      if (err) throw new DomainError(err, { password: err });
    }
    const clash = await prisma.user.findFirst({
      where: {
        OR: [{ email: input.email }, ...(input.username ? [{ username: input.username }] : [])],
        ...(input.id ? { id: { not: input.id } } : {}),
      },
    });
    if (clash) throw new DomainError("Email or username already in use.", clash.email === input.email ? { email: "Already in use" } : { username: "Already in use" });

    if (input.id) {
      const before = await prisma.user.findUniqueOrThrow({ where: { id: input.id } });
      if (input.id === me.id && (input.role !== "ADMIN" || !input.active)) {
        throw new DomainError("You cannot remove your own administrator access or deactivate yourself.");
      }
      await prisma.user.update({
        where: { id: input.id },
        data: {
          name: input.name, email: input.email, username: input.username, role: input.role, active: input.active,
          ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
        },
      });
      if (!input.active) await prisma.session.deleteMany({ where: { userId: input.id } });
      const changes = [
        before.role !== input.role && `role ${before.role} → ${input.role}`,
        before.active !== input.active && (input.active ? "activated" : "deactivated"),
        input.password && "password reset",
        before.email !== input.email && `email ${before.email} → ${input.email}`,
      ].filter(Boolean);
      await auditEvent(prisma, me, { entityType: "User", entityId: input.id, action: "UPDATE", message: `User ${input.name} updated${changes.length ? `: ${changes.join(", ")}` : ""}` });
    } else {
      if (!input.password) throw new DomainError("A password is required for new users.", { password: "Required" });
      const u = await prisma.user.create({
        data: { name: input.name, email: input.email, username: input.username, role: input.role, active: input.active, passwordHash: await hashPassword(input.password) },
      });
      await auditEvent(prisma, me, { entityType: "User", entityId: u.id, action: "CREATE", message: `User ${u.name} (${u.role}) created` });
    }
    refresh();
    return true;
  },
);

export const changeOwnPasswordAction = defineAction(
  "asset.view",
  z.object({ current: z.string().min(1, "Required"), next: z.string().min(1, "Required") }),
  async ({ current, next }, me) => {
    const { verifyPassword } = await import("@/lib/auth/password");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(current, u.passwordHash))) throw new DomainError("Current password is incorrect.", { current: "Incorrect" });
    const err = passwordPolicyError(next);
    if (err) throw new DomainError(err, { next: err });
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(next) } });
    await auditEvent(prisma, me, { entityType: "User", entityId: me.id, action: "PASSWORD", message: `${me.name} changed their password` });
    return true;
  },
);

// ── Locations ────────────────────────────────────────────────

export const saveLocationAction = defineAction(
  "reference.manage",
  saveLocationSchema,
  async (input, me) => {
    const clash = await prisma.location.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, ...(input.id ? { id: { not: input.id } } : {}) } });
    if (clash) throw new DomainError("A location with this name already exists.", { name: "Already exists" });
    if (input.id) {
      const before = await prisma.location.findUniqueOrThrow({ where: { id: input.id } });
      await prisma.location.update({ where: { id: input.id }, data: { name: input.name, description: input.description, aliases: input.aliases, active: input.active } });
      await auditEvent(prisma, me, {
        entityType: "Location", entityId: input.id, action: "UPDATE",
        message: `Location "${before.name}" updated${before.name !== input.name ? ` (renamed to "${input.name}")` : ""}${before.active !== input.active ? (input.active ? ", reactivated" : ", deactivated") : ""}`,
      });
    } else {
      const max = await prisma.location.aggregate({ _max: { sortOrder: true } });
      const l = await prisma.location.create({ data: { name: input.name, description: input.description, aliases: input.aliases, active: input.active, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await auditEvent(prisma, me, { entityType: "Location", entityId: l.id, action: "CREATE", message: `Location "${l.name}" created` });
    }
    refresh();
    return true;
  },
);

// ── Asset types ─────────────────────────────────────────────


export const saveAssetTypeAction = defineAction(
  "reference.manage",
  saveAssetTypeSchema,
  async (input, me) => {
    const clash = await prisma.assetType.findFirst({
      where: { OR: [{ name: { equals: input.name, mode: "insensitive" } }, { prefix: input.prefix }], ...(input.id ? { id: { not: input.id } } : {}) },
    });
    if (clash) throw new DomainError("Name or prefix already used by another type.");
    if (input.id) {
      const before = await prisma.assetType.findUniqueOrThrow({ where: { id: input.id }, include: { _count: { select: { assets: true } } } });
      if (before.prefix !== input.prefix && before._count.assets > 0) {
        throw new DomainError("The prefix cannot be changed once assets have been registered with it.", { prefix: "Locked — assets exist" });
      }
      await prisma.assetType.update({ where: { id: input.id }, data: { name: input.name, prefix: input.prefix, description: input.description, active: input.active, config: input.config } });
      await auditEvent(prisma, me, { entityType: "AssetType", entityId: input.id, action: "UPDATE", message: `Asset type "${input.name}" updated` });
    } else {
      const max = await prisma.assetType.aggregate({ _max: { sortOrder: true } });
      const t = await prisma.assetType.create({ data: { name: input.name, prefix: input.prefix, description: input.description, active: input.active, config: input.config, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await auditEvent(prisma, me, { entityType: "AssetType", entityId: t.id, action: "CREATE", message: `Asset type "${t.name}" (${t.prefix}) created` });
    }
    refresh();
    return true;
  },
);

// ── Statuses ────────────────────────────────────────────────

export const saveStatusAction = defineAction(
  "reference.manage",
  saveStatusSchema,
  async (input, me) => {
    const clash = await prisma.status.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, ...(input.id ? { id: { not: input.id } } : {}) } });
    if (clash) throw new DomainError("A status with this name already exists.", { name: "Already exists" });
    if (input.id) {
      const before = await prisma.status.findUniqueOrThrow({ where: { id: input.id } });
      if (before.code !== "CUSTOM" && !input.active) throw new DomainError(`"${before.name}" is a system status used by workflows and cannot be deactivated (it can be renamed).`);
      await prisma.status.update({ where: { id: input.id }, data: { name: input.name, color: input.color, active: input.active } });
      await auditEvent(prisma, me, { entityType: "Status", entityId: input.id, action: "UPDATE", message: `Status "${before.name}" updated${before.name !== input.name ? ` → "${input.name}"` : ""}` });
    } else {
      const max = await prisma.status.aggregate({ _max: { sortOrder: true } });
      const s = await prisma.status.create({ data: { name: input.name, color: input.color, active: input.active, code: "CUSTOM", sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await auditEvent(prisma, me, { entityType: "Status", entityId: s.id, action: "CREATE", message: `Status "${s.name}" created` });
    }
    refresh();
    return true;
  },
);

// ── Lookup values (conditions, departments, shifts, SIM operators, brands) ──

const catEnum = z.enum(["CONDITION", "DEPARTMENT", "SHIFT", "SIM_OPERATOR", "BRAND"]);

export const addLookupAction = defineAction("reference.manage", z.object({ category: catEnum, value: reqStr("Value", 80) }), async ({ category, value }, me) => {
  const exists = await prisma.lookupValue.findFirst({ where: { category, value: { equals: value, mode: "insensitive" } } });
  if (exists) {
    if (!exists.active) await prisma.lookupValue.update({ where: { id: exists.id }, data: { active: true } });
    else throw new DomainError(`"${value}" already exists.`);
  } else {
    const max = await prisma.lookupValue.aggregate({ where: { category }, _max: { sortOrder: true } });
    await prisma.lookupValue.create({ data: { category, value, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  }
  await auditEvent(prisma, me, { entityType: "Lookup", action: "CREATE", message: `${category.toLowerCase().replace("_", " ")} "${value}" added` });
  refresh();
  return true;
});

export const toggleLookupAction = defineAction("reference.manage", z.object({ id: z.string(), active: z.boolean() }), async ({ id, active }, me) => {
  const l = await prisma.lookupValue.update({ where: { id }, data: { active } });
  await auditEvent(prisma, me, { entityType: "Lookup", entityId: id, action: "UPDATE", message: `${l.category.toLowerCase().replace("_", " ")} "${l.value}" ${active ? "activated" : "deactivated"}` });
  refresh();
  return true;
});

// ── Settings ────────────────────────────────────────────────

export const saveSettingsAction = defineAction(
  "settings.manage",
  saveSettingsSchema,
  async (input, me) => {
    if (input.logo && !/^data:image\/(png|jpeg|svg\+xml|webp);base64,/.test(input.logo)) throw new DomainError("Logo must be a PNG, JPEG, SVG or WebP image.");
    const before = await getSettings();
    const { recalculate, ...patch } = input;
    await saveSettings(patch);
    const changes = (Object.keys(patch) as (keyof typeof patch)[])
      .filter((k) => k !== "logo" && String(before[k]) !== String(patch[k]))
      .map((k) => `${k}: ${before[k]} → ${patch[k]}`);
    if (before.logo !== (input.logo ?? null)) changes.push("logo updated");
    let recalculated = 0;
    if (recalculate && before.verificationIntervalDays !== input.verificationIntervalDays) {
      recalculated = await prisma.$executeRaw`UPDATE assets SET next_verification_date = last_verification_date + (${input.verificationIntervalDays}::int), updated_at = now() WHERE last_verification_date IS NOT NULL`;
      changes.push(`next verification recalculated for ${recalculated} assets`);
    }
    await auditEvent(prisma, me, { entityType: "Settings", action: "UPDATE", message: `Settings updated${changes.length ? `: ${changes.join("; ")}` : ""}` });
    refresh();
    return { recalculated };
  },
);

// ── Notifications ───────────────────────────────────────────

export async function markNotificationsReadAction(ids: string[] | "all") {
  const me = await getCurrentUser();
  if (!me) return;
  await markRead(me.id, ids, me.role);
  revalidatePath("/", "layout");
}
