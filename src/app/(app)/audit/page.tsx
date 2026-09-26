import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { listAudit, parseAuditFilters } from "@/lib/services/history";
import { PageHeader, Pagination } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { ExportMenu } from "@/components/shared/export-menu";
import { AuditFilterBar } from "@/components/admin/audit-filter-bar";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Trail" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePagePermission("audit.view");
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const { total, rows } = await listAudit(f);
  const query = new URLSearchParams(Object.entries({ q: f.q, entity: f.entity, user: f.user, from: f.from, to: f.to }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="Every change is recorded with who, when, and the previous and new values. Audit records are append-only — they cannot be edited or deleted (enforced by the database)."
        actions={<ExportMenu report="audit" query={query} />}
      />
      <Card className="overflow-hidden">
        <AuditFilterBar filters={f} total={total} />
        <Table>
          <THead><TR><TH>When</TH><TH>User</TH><TH>Entity</TH><TH>Action</TH><TH>Asset</TH><TH>Change</TH><TH>Previous</TH><TH>New</TH></TR></THead>
          <TBody>
            {rows.length === 0 ? <EmptyRow colSpan={8}>No audit entries match.</EmptyRow> : rows.map((r) => (
              <TR key={r.id}>
                <TD className="whitespace-nowrap tabular text-slate-600">{formatDateTime(r.createdAt)}</TD>
                <TD className="whitespace-nowrap">{r.userName ?? "System"}</TD>
                <TD>{r.entityType}</TD>
                <TD><Badge color="gray">{r.action}</Badge></TD>
                <TD>{r.assetCode ? <Link href={`/assets/${encodeURIComponent(r.assetCode)}`} className="font-mono text-primary hover:underline">{r.assetCode}</Link> : "—"}</TD>
                <TD className="min-w-[18rem]">{r.message}</TD>
                <TD className="max-w-[10rem] truncate text-slate-500" title={r.oldValue ?? ""}>{r.oldValue ?? "—"}</TD>
                <TD className="max-w-[10rem] truncate text-slate-500" title={r.newValue ?? ""}>{r.newValue ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <Pagination page={f.page} pageSize={f.pageSize} total={total} hrefFor={(p) => `/audit?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), page: String(p) })}`} />
      </Card>
    </div>
  );
}
