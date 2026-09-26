import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/misc";
import { ImportReview } from "@/components/import/import-review";
import type { ImportSummary, StagedMovement, StagedRow } from "@/lib/import/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review import" };

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("import.run");
  const batch = await prisma.importBatch.findUnique({ where: { id: (await params).id } });
  if (!batch) notFound();
  const data = batch.rows as unknown as { rows?: StagedRow[]; movements?: StagedMovement[] };
  return (
    <div>
      <PageHeader
        breadcrumb={<Link href="/import" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" /> Import from Excel</Link>}
        title="Import validation"
        description={`${batch.fileName} — review the findings, choose which rows to import, then confirm.`}
      />
      <ImportReview
        batchId={batch.id}
        status={batch.status}
        summary={batch.summary as unknown as ImportSummary}
        rows={data.rows ?? []}
        movements={data.movements ?? []}
        result={batch.result as Record<string, unknown> | null}
      />
    </div>
  );
}
