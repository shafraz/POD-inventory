import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/misc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { ImportUpload } from "@/components/import/import-upload";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import from Excel" };

export default async function ImportPage() {
  await requirePagePermission("import.run");
  const batches = await prisma.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, fileName: true, status: true, createdAt: true, committedAt: true, summary: true, result: true } });
  return (
    <div className="space-y-5">
      <PageHeader title="Import from Excel" description="Upload the inventory workbook. Nothing is written until you review the validation results and confirm." />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <ImportUpload />
        <Card>
          <CardHeader>
            <div>
              <CardTitle>What gets imported</CardTitle>
              <CardDescription>Sheets are recognised by name</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px] text-slate-700">
            <p><b>Asset Register</b> — the consolidated master list (preferred source; one row per device).</p>
            <p><b>Tab 8&quot;, Tab 10&quot;, PC, VHF</b> — legacy sheets, matched to register rows by source reference / serial / IMEI and used to fill empty fields. Rows that can’t be matched are <b>flagged, not imported</b>, unless you choose to include them.</p>
            <p><b>Movement Log</b> — historical movements (rows need a date and Asset ID).</p>
            <p><b>Lists</b> — new locations, statuses and SIM operators are added.</p>
            <p className="text-muted-foreground"><b>Dashboard</b> is ignored — figures are always calculated live. Original cell values and remarks are preserved on each asset.</p>
          </CardContent>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHeader><CardTitle>Import history</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Uploaded</TH><TH>File</TH><TH>Rows</TH><TH>Status</TH><TH>Result</TH><TH /></TR></THead>
          <TBody>
            {batches.length === 0 ? <EmptyRow colSpan={6}>No imports yet. (The initial migration was performed by the seed script.)</EmptyRow> : batches.map((b) => {
              const s = b.summary as { totalAssets?: number };
              const r = b.result as { assetsCreated?: number; flaggedForReview?: number } | null;
              return (
                <TR key={b.id}>
                  <TD className="whitespace-nowrap">{formatDateTime(b.createdAt)}</TD>
                  <TD>{b.fileName}</TD>
                  <TD className="tabular">{s.totalAssets ?? "—"}</TD>
                  <TD><Badge color={b.status === "COMMITTED" ? "green" : b.status === "STAGED" ? "yellow" : "gray"}>{b.status.toLowerCase()}</Badge></TD>
                  <TD className="text-slate-600">{r ? `${r.assetsCreated} created, ${r.flaggedForReview} flagged` : "—"}</TD>
                  <TD className="text-right">{b.status === "STAGED" && <Link href={`/import/${b.id}`} className="text-[13px] font-medium text-primary hover:underline">Review</Link>}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
