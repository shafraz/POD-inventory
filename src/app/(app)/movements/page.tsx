import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listMovements, listRequests, parseMovementFilters } from "@/lib/services/history";
import { PageHeader, ActionBadge, Pagination } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExportMenu } from "@/components/shared/export-menu";
import { MovementFilterBar } from "@/components/movements/movement-filter-bar";
import { RecordMovementButton } from "@/components/movements/record-movement-button";
import { RequestsTable } from "@/components/movements/requests-table";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Movement & Transfers" };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "requests" ? "requests" : "log";
  const f = parseMovementFilters(sp);
  const reviewer = can(user.role, "request.review");
  const [log, requests, pendingCount] = await Promise.all([
    tab === "log" ? listMovements(f) : Promise.resolve({ total: 0, rows: [] }),
    tab === "requests" ? listRequests(sp.all === "1" ? "ALL" : "PENDING", reviewer ? undefined : user.id) : Promise.resolve([]),
    listRequests("PENDING", reviewer ? undefined : user.id).then((r) => r.length),
  ]);
  const query = new URLSearchParams(Object.entries({ from: f.from, to: f.to, asset: f.asset, action: f.action, location: f.location, user: f.user }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <PageHeader
        title="Movement & Transfers"
        description="Every issue, return, transfer, repair and verification is a permanent transaction. The register always shows the current state."
        actions={
          <>
            {tab === "log" && can(user.role, "report.view") && <ExportMenu report="movements" query={query} />}
            <RecordMovementButton />
          </>
        }
      />
      <div className="mb-4 flex gap-1 border-b">
        {[{ k: "log", l: "Movement log" }, { k: "requests", l: `Requests${pendingCount ? ` (${pendingCount})` : ""}` }].map((t) => (
          <Link key={t.k} href={t.k === "log" ? "/movements" : "/movements?tab=requests"} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", tab === t.k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800")} data-testid={`tab-${t.k}`}>
            {t.l}
          </Link>
        ))}
      </div>

      {tab === "log" ? (
        <Card className="overflow-hidden">
          <MovementFilterBar filters={f} total={log.total} />
          <Table data-testid="movement-log">
            <THead>
              <TR><TH>Date</TH><TH>Asset ID</TH><TH>Device</TH><TH>Action</TH><TH>From</TH><TH>To</TH><TH>Assigned to</TH><TH>Status after</TH><TH>Done by</TH><TH>Notes</TH></TR>
            </THead>
            <TBody>
              {log.rows.length === 0 ? (
                <EmptyRow colSpan={10}>No movements match these filters.</EmptyRow>
              ) : (
                log.rows.map((m) => (
                  <TR key={m.id}>
                    <TD className="whitespace-nowrap tabular">{formatDate(m.date)}</TD>
                    <TD><Link href={`/assets/${encodeURIComponent(m.asset.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{m.asset.assetId}</Link></TD>
                    <TD className="whitespace-nowrap text-slate-600">{m.asset.deviceName}</TD>
                    <TD><ActionBadge action={m.action} /></TD>
                    <TD>{m.fromLocation ?? "—"}</TD>
                    <TD>{m.toLocation ?? "—"}</TD>
                    <TD>{m.assignedTo ?? "—"}</TD>
                    <TD>{m.statusAfter ?? "—"}</TD>
                    <TD className="whitespace-nowrap text-slate-600">{m.doneBy ?? m.recordedBy?.name ?? "—"}</TD>
                    <TD className="max-w-xs truncate text-slate-500" title={[m.reason, m.notes].filter(Boolean).join(" — ")}>
                      {[m.reason, m.notes].filter(Boolean).join(" — ") || "—"}
                      {m.source === "IMPORT" && <Badge color="gray" className="ml-1.5">imported</Badge>}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
          <Pagination page={f.page} pageSize={f.pageSize} total={log.total} hrefFor={(p) => `/movements?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), page: String(p) })}`} />
        </Card>
      ) : (
        <RequestsTable
          reviewer={reviewer}
          showAll={sp.all === "1"}
          rows={requests.map((r) => ({
            id: r.id, type: r.type, status: r.status, createdAt: r.createdAt.toISOString(), notes: r.notes, payload: r.payload as Record<string, string | null>,
            asset: { id: r.asset.id, assetId: r.asset.assetId, deviceName: r.asset.deviceName, location: r.asset.location?.name ?? null, status: r.asset.status.name, statusColor: r.asset.status.color },
            requestedBy: r.requestedBy.name, reviewedBy: r.reviewedBy?.name ?? null, reviewNote: r.reviewNote,
          }))}
        />
      )}
    </div>
  );
}
