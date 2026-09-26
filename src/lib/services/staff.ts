import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/session";
import { DomainError } from "@/lib/action";
import type { StaffInput } from "@/lib/validation/schemas";
import { auditEvent } from "./audit";

/**
 * Staff are the people who receive and return devices (tallies, drivers, supervisors…).
 * They are not system users — they don't sign in. Assets link to the staff member
 * currently holding them; movements keep who held them historically.
 */

export type StaffFilters = { q?: string; shift?: string; status?: "active" | "inactive" | "all"; holding?: boolean };

export function staffWhere(f: StaffFilters): Prisma.StaffWhereInput {
  const and: Prisma.StaffWhereInput[] = [];
  const status = f.status ?? "active";
  if (status !== "all") and.push({ active: status === "active" });
  if (f.shift) and.push({ shift: f.shift });
  if (f.holding) and.push({ assets: { some: { archived: false } } });
  if (f.q) {
    const c = { contains: f.q.trim(), mode: "insensitive" as const };
    and.push({ OR: [{ name: c }, { employeeNumber: c }, { designation: c }, { department: c }, { phone: c }] });
  }
  return and.length ? { AND: and } : {};
}

export async function listStaff(f: StaffFilters) {
  return prisma.staff.findMany({
    where: staffWhere(f),
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      assets: {
        where: { archived: false },
        select: { assetId: true, deviceName: true, assetType: { select: { name: true, prefix: true } } },
        orderBy: { assetId: "asc" },
      },
    },
  });
}

export async function getStaffDetail(id: string) {
  const s = await prisma.staff.findUnique({
    where: { id },
    include: {
      assets: {
        where: { archived: false },
        orderBy: { assetId: "asc" },
        include: { assetType: true, location: true, status: true },
      },
      movements: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 200,
        include: { asset: { select: { assetId: true, deviceName: true, assetType: { select: { name: true } } } } },
      },
    },
  });
  return s;
}

/** Distinct designations already in use (for the form's suggestions). */
export async function staffDesignations() {
  const rows = await prisma.staff.findMany({ where: { designation: { not: null } }, distinct: ["designation"], select: { designation: true }, orderBy: { designation: "asc" } });
  return rows.map((r) => r.designation!).filter(Boolean);
}

/** Staff picker search (movement forms). */
export async function searchStaffOptions(q: string, limit = 20) {
  const term = q.trim();
  const rows = await prisma.staff.findMany({
    where: {
      active: true,
      ...(term
        ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { employeeNumber: { contains: term, mode: "insensitive" } }, { designation: { contains: term, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, employeeNumber: true, designation: true, shift: true, _count: { select: { assets: { where: { archived: false } } } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, employeeNumber: r.employeeNumber, designation: r.designation, shift: r.shift, holding: r._count.assets }));
}
export type StaffOption = Awaited<ReturnType<typeof searchStaffOptions>>[number];

export async function saveStaff(input: StaffInput, user: CurrentUser) {
  const clash = await prisma.staff.findFirst({
    where: { employeeNumber: { equals: input.employeeNumber, mode: "insensitive" }, ...(input.id ? { id: { not: input.id } } : {}) },
  });
  if (clash) throw new DomainError(`Employee number ${input.employeeNumber} already belongs to ${clash.name}.`, { employeeNumber: "Already in use" });

  const data = {
    name: input.name,
    employeeNumber: input.employeeNumber,
    designation: input.designation,
    shift: input.shift,
    department: input.department,
    phone: input.phone,
    notes: input.notes,
    active: input.active,
  };

  if (input.id) {
    const before = await prisma.staff.findUniqueOrThrow({ where: { id: input.id } });
    const after = await prisma.staff.update({ where: { id: input.id }, data });
    const labels: Record<string, string> = { name: "name", employeeNumber: "employee number", designation: "designation", shift: "shift", department: "department", phone: "phone", active: "status" };
    const changes = Object.keys(labels)
      .filter((k) => String(before[k as keyof typeof before] ?? "") !== String(after[k as keyof typeof after] ?? ""))
      .map((k) => (k === "active" ? (after.active ? "reactivated" : "deactivated") : `${labels[k]} ${before[k as keyof typeof before] ?? "—"} → ${after[k as keyof typeof after] ?? "—"}`));
    // Keep the "Assigned to" text on assets in step with a renamed staff member
    if (before.name !== after.name) {
      await prisma.asset.updateMany({ where: { staffId: after.id }, data: { assignedTo: after.name } });
    }
    await auditEvent(prisma, user, {
      entityType: "Staff", entityId: after.id, action: "UPDATE",
      message: `Staff ${after.name} (${after.employeeNumber}) updated${changes.length ? `: ${changes.join("; ")}` : ""}`,
    });
    return after;
  }
  const created = await prisma.staff.create({ data });
  await auditEvent(prisma, user, {
    entityType: "Staff", entityId: created.id, action: "CREATE",
    message: `Staff ${created.name} (${created.employeeNumber}) added${created.designation ? ` — ${created.designation}` : ""}${created.shift ? `, ${created.shift}` : ""}`,
  });
  return created;
}
