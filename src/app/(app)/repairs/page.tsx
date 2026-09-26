import Link from "next/link";
import { Paperclip } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listDamageReports, listRepairs } from "@/lib/services/history";
import { PageHeader } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { ExportMenu } from "@/components/shared/export-menu";
import { RecordMovementButton } from "@/components/movements/record-movement-button";
import { RepairInButton } from "@/components/operations/repair-in-button";
import { REPAIR_STATUS_LABELS, SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/constants";
import { cn, daysBetween, formatDate, todayDate } from "@/lib/utils";
import type { RepairStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repairs & Damage" };

export default async function RepairsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab === "damage" ? "damage" : "repairs";
  const status = (["OPEN", "COMPLETED", "NOT_REPAIRABLE", "ALL"].includes(sp.status ?? "") ? sp.status : "OPEN") as RepairStatus | "ALL";
  const [repairs, damage] = await Promise.all([tab === "repairs" ? listRepairs(status, sp.q) : [], tab === "damage" ? listDamageReports(sp.q) : []]);
  const today = todayDate();
  const statusLink = (s: string) => `/repairs?status=${s}`;

  return (
    <div>
      <PageHeader
        title="Repairs & Damage"
        description="Send assets for repair, record their return, and track damage reports."
        actions={
          <>
            {can(user.role, "report.view") && (tab === "repairs" ? <ExportMenu report="under-repair" query={`repairStatus=${status}`} /> : <ExportMenu report="damaged" />)}
            {(can(user.role, "damage.report")) && <RecordMovementButton kind="MARK_DAMAGED" label="Report Damage" icon="damage" />}
            <RecordMovementButton kind="REPAIR_OUT" label="Send for Repair" icon="repair" />
          </>
        }
      />
      <div className="mb-4 flex gap-1 border-b">
        {[{ k: "repairs", l: "Repair cases", href: "/repairs" }, { k: "damage", l: "Damage reports", href: "/repairs?tab=damage" }].map((t) => (
          <Link key={t.k} href={t.href} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", tab === t.k ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800")}>{t.l}</Link>
        ))}
      </div>

      {tab === "repairs" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-1.5 border-b p-3">
            {(["OPEN", "COMPLETED", "NOT_REPAIRABLE", "ALL"] as const).map((s) => (
              <Link key={s} href={statusLink(s)} className={cn("rounded-full border px-3 py-1 text-[12.5px] font-medium", status === s ? "border-primary bg-primary text-white" : "bg-card text-slate-600 hover:bg-muted")}>
                {s === "ALL" ? "All cases" : REPAIR_STATUS_LABELS[s]}
              </Link>
            ))}
          </div>
          <Table data-testid="repairs-table">
            <THead><TR><TH>Asset</TH><TH>Repair out</TH><TH>Problem</TH><TH>Vendor / technician</TH><TH>Expected</TH><TH>Returned</TH><TH>Repair action</TH><TH className="text-right">Cost</TH><TH>Status</TH><TH /></TR></THead>
            <TBody>
              {repairs.length === 0 ? <EmptyRow colSpan={10}>No repair cases.</EmptyRow> : repairs.map((r) => {
                const overdue = r.status === "OPEN" && r.expectedReturnDate && r.expectedReturnDate < today;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/assets/${encodeURIComponent(r.asset.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{r.asset.assetId}</Link>
                      <div className="text-[12px] text-slate-500">{r.asset.deviceName} · {r.asset.assetType.name}</div>
                    </TD>
                    <TD className="whitespace-nowrap tabular">
                      {formatDate(r.repairOutDate)}
                      {r.status === "OPEN" && r.repairOutDate && <div className="text-[11px] text-slate-400">{daysBetween(r.repairOutDate, today)} days</div>}
                    </TD>
                    <TD className="max-w-[14rem]">{r.reportedProblem ?? "—"}</TD>
                    <TD>{r.technician ?? "—"}</TD>
                    <TD className={cn("whitespace-nowrap tabular", overdue && "font-medium text-red-600")}>{formatDate(r.expectedReturnDate)}</TD>
                    <TD className="whitespace-nowrap tabular">{formatDate(r.repairInDate)}</TD>
                    <TD className="max-w-[14rem] text-slate-600">{[r.repairDescription, r.partsReplaced && `Parts: ${r.partsReplaced}`].filter(Boolean).join(" — ") || "—"}</TD>
                    <TD className="text-right tabular">{r.cost ? Number(r.cost).toFixed(2) : "—"}</TD>
                    <TD><Badge color={r.status === "OPEN" ? "orange" : r.status === "COMPLETED" ? "green" : "red"}>{REPAIR_STATUS_LABELS[r.status]}</Badge>{r.source === "IMPORT" && <Badge color="gray" className="ml-1">imported</Badge>}</TD>
                    <TD className="text-right">{r.status === "OPEN" && can(user.role, "repair.manage") && <RepairInButton assetId={r.assetId} />}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead><TR><TH>Date</TH><TH>Asset</TH><TH>Severity</TH><TH>Description</TH><TH>Reported by</TH><TH>Location</TH><TH>Current status</TH><TH>Photos</TH></TR></THead>
            <TBody>
              {damage.length === 0 ? <EmptyRow colSpan={8}>No damage reports.</EmptyRow> : damage.map((d) => (
                <TR key={d.id}>
                  <TD className="whitespace-nowrap tabular">{formatDate(d.date)}</TD>
                  <TD><Link href={`/assets/${encodeURIComponent(d.asset.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{d.asset.assetId}</Link><div className="text-[12px] text-slate-500">{d.asset.deviceName}</div></TD>
                  <TD><Badge color={SEVERITY_COLORS[d.severity]}>{SEVERITY_LABELS[d.severity]}</Badge></TD>
                  <TD className="max-w-xs">{d.description}</TD>
                  <TD>{d.reportedBy ?? "—"}</TD>
                  <TD>{d.location ?? "—"}</TD>
                  <TD><Badge color={d.asset.status.color} dot>{d.asset.status.name}</Badge></TD>
                  <TD>{d.attachments.length ? d.attachments.map((a) => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" className="mr-2 inline-flex items-center gap-1 text-primary hover:underline"><Paperclip className="size-3" />{a.fileName}</a>) : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
