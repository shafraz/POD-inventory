"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defineAction } from "@/lib/action";
import { assetInputSchema, assetUpdateSchema, bulkStatusSchema, bulkVerifySchema } from "@/lib/validation/schemas";
import * as assets from "@/lib/services/assets";
import { bulkStatus, bulkVerify } from "@/lib/services/operations";
import { assertPermission } from "@/lib/auth/session";
import { todayISO } from "@/lib/utils";

function refresh(code?: string) {
  revalidatePath("/", "layout");
  if (code) revalidatePath(`/assets/${code}`);
}

export const createAssetAction = defineAction("asset.create", assetInputSchema, async (input, user) => {
  const a = await assets.createAsset(input, user);
  refresh();
  return { id: a.id, assetId: a.assetId };
});

export const updateAssetAction = defineAction("asset.edit", assetUpdateSchema, async ({ id, ...input }, user) => {
  const a = await assets.updateAsset(id, input, user);
  refresh(a.assetId);
  return { id: a.id, assetId: a.assetId };
});

export const deleteAssetAction = defineAction("asset.delete", z.object({ id: z.string().min(1) }), async ({ id }, user) => {
  await assets.deleteAsset(id, user);
  refresh();
  return true;
});

export const restoreAssetAction = defineAction("asset.delete", z.object({ id: z.string().min(1) }), async ({ id }, user) => {
  const a = await assets.restoreAsset(id, user);
  refresh(a.assetId);
  return true;
});

export const resolveReviewAction = defineAction("asset.edit", z.object({ id: z.string().min(1) }), async ({ id }, user) => {
  const a = await assets.resolveReview(id, user);
  refresh(a.assetId);
  return true;
});

export const bulkVerifyAction = defineAction("verify", bulkVerifySchema, async ({ ids, date, notes }, user) => {
  const r = await bulkVerify(ids, date, notes, user);
  refresh();
  return r;
});

export const bulkStatusAction = defineAction("asset.edit", bulkStatusSchema, async ({ ids, statusId, reason }, user) => {
  const r = await bulkStatus(ids, statusId, reason, user, todayISO());
  refresh();
  return r;
});

/** Used by the Add Asset form to preview the ID that will be assigned. */
export async function previewNextAssetId(assetTypeId: string) {
  await assertPermission("asset.view");
  if (!assetTypeId) return null;
  return assets.nextAssetId(assetTypeId);
}

/** Asset picker search (movement forms). */
export async function searchAssetsAction(q: string) {
  await assertPermission("asset.view");
  return assets.searchAssetOptions(q);
}

/** Current state shown after picking an asset in a form (minimises data entry). */
export async function lookupAssetAction(idOrCode: string) {
  await assertPermission("asset.view");
  return assets.lookupAsset(idOrCode);
}
