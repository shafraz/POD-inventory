"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineAction, DomainError } from "@/lib/action";
import { commitImport } from "@/lib/import/commit";
import type { StagedImport } from "@/lib/import/types";

export const commitImportAction = defineAction(
  "import.run",
  z.object({ batchId: z.string().min(1), include: z.array(z.string()) }),
  async ({ batchId, include }, user) => {
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.status !== "STAGED") throw new DomainError("This import has already been processed or discarded.");
    const staged: StagedImport = { summary: batch.summary as never, ...(batch.rows as unknown as Pick<StagedImport, "rows" | "movements">) };
    const result = await commitImport(staged, new Set(include), user);
    await prisma.importBatch.update({ where: { id: batchId }, data: { status: "COMMITTED", committedAt: new Date(), result } });
    revalidatePath("/", "layout");
    return result;
  },
);

export const discardImportAction = defineAction("import.run", z.object({ batchId: z.string().min(1) }), async ({ batchId }) => {
  await prisma.importBatch.update({ where: { id: batchId }, data: { status: "DISCARDED", rows: {} } });
  revalidatePath("/import");
  return true;
});
