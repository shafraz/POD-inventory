"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction, DomainError, toActionError, type ActionResult } from "@/lib/action";
import {
  damageSchema, disposeSchema, issueSchema, lostSchema, osUpdateSchema, repairInSchema, repairOutSchema,
  requestSchema, returnSchema, statusChangeSchema, transferSchema, verifySchema,
} from "@/lib/validation/schemas";
import * as ops from "@/lib/services/operations";
import { assertPermission, type CurrentUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";

const refresh = () => revalidatePath("/", "layout");

function wrap<S extends z.ZodTypeAny, T>(perm: Permission, schema: S, fn: (i: z.infer<S>, u: CurrentUser) => Promise<T>) {
  return defineAction(perm, schema, async (input, user) => {
    const r = await fn(input, user);
    refresh();
    return r;
  });
}

export const issueAction = wrap("movement.record", issueSchema, ops.issueAsset);
export const transferAction = wrap("movement.record", transferSchema, ops.transferAsset);
export const returnAction = wrap("movement.record", returnSchema, ops.returnAsset);
export const disposeAction = wrap("movement.record", disposeSchema, ops.disposeAsset);
export const lostAction = wrap("movement.record", lostSchema, ops.markLost);
export const statusChangeAction = wrap("asset.edit", statusChangeSchema, async (i, u) => ops.changeStatus(i, u));
export const repairOutAction = wrap("repair.manage", repairOutSchema, ops.repairOut);
export const repairInAction = wrap("repair.manage", repairInSchema, ops.repairIn);
export const verifyAction = wrap("verify", verifySchema, async (i, u) => ops.verifyAsset(i, u));
export const osUpdateAction = wrap("os.update", osUpdateSchema, ops.recordOsUpdate);
export const requestAction = wrap("movement.request", requestSchema, ops.createRequest);

export const rejectRequestAction = defineAction(
  "request.review",
  z.object({ id: z.string().min(1), note: z.string().max(500).optional().nullable() }),
  async ({ id, note }, user) => {
    await ops.rejectRequest(id, note ?? null, user);
    refresh();
    return true;
  },
);

/** Damage report with optional photos (multipart form). Operations Users may report damage. */
export async function damageAction(form: FormData): Promise<ActionResult<{ assetId: string }>> {
  try {
    const user = await assertPermission("damage.report");
    const parsed = damageSchema.safeParse({
      assetId: form.get("assetId"),
      date: form.get("date"),
      description: form.get("description"),
      severity: form.get("severity"),
      reportedBy: form.get("reportedBy"),
      location: form.get("location"),
      notes: form.get("notes"),
      doneBy: form.get("reportedBy"),
      requestId: null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
    }
    const files: { name: string; type: string; data: Buffer }[] = [];
    for (const f of form.getAll("photos")) {
      if (!(f instanceof File) || f.size === 0) continue;
      if (f.size > 5 * 1024 * 1024) throw new DomainError(`${f.name} is larger than 5 MB`);
      if (!/^image\/|application\/pdf/.test(f.type)) throw new DomainError(`${f.name}: only images or PDF are allowed`);
      files.push({ name: f.name.slice(0, 200), type: f.type, data: Buffer.from(await f.arrayBuffer()) });
    }
    if (files.length > 5) throw new DomainError("Attach at most 5 files");
    const r = await ops.reportDamage(parsed.data, user, files);
    refresh();
    return { ok: true, data: { assetId: r.assetId } };
  } catch (e) {
    return toActionError(e);
  }
}
