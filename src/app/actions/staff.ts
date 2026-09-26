"use server";

import { revalidatePath } from "next/cache";
import { defineAction } from "@/lib/action";
import { staffSchema } from "@/lib/validation/schemas";
import { saveStaff, searchStaffOptions } from "@/lib/services/staff";
import { prisma } from "@/lib/db";
import { assertPermission } from "@/lib/auth/session";

export const saveStaffAction = defineAction("staff.manage", staffSchema, async (input, user) => {
  const s = await saveStaff(input, user);
  revalidatePath("/", "layout");
  return { id: s.id, name: s.name };
});

/** Staff picker search for movement forms. */
export async function searchStaffAction(q: string) {
  await assertPermission("asset.view");
  return searchStaffOptions(q);
}

/** Resolve one staff member for pre-filled forms (e.g. actioning a request). */
export async function getStaffOptionAction(id: string) {
  await assertPermission("asset.view");
  const s = await prisma.staff.findUnique({ where: { id }, include: { _count: { select: { assets: { where: { archived: false } } } } } });
  return s ? { id: s.id, name: s.name, employeeNumber: s.employeeNumber, designation: s.designation, shift: s.shift, holding: s._count.assets } : null;
}
