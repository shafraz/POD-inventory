"use client";

import type { MovementAction, RepairStatus, DamageSeverity, VerificationResult } from "@prisma/client";
import { History, Wrench, ShieldCheck, TriangleAlert, RefreshCw, ScrollText, FileSpreadsheet, Check, Minus, Paperclip } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionBadge } from "@/components/shared/misc";
import { REPAIR_STATUS_LABELS, SEVERITY_COLORS, SEVERITY_LABELS, VERIFICATION_RESULT_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";

type Props = {
  movements: { id: string; date: string; action: MovementAction; from: string | null; to: string | null; assignedTo: string | null; statusAfter: string | null; doneBy: string | null; notes: string | null; source: string }[];
  repairs: { id: string; status: RepairStatus; out: string | null; problem: string | null; technician: string | null; expected: string | null; in: string | null; description: string | null; parts: string | null; cost: number | null; notes: string | null }[];
  verifications: { id: string; date: string; result: VerificationResult; location: string | null; assigned: string | null; condition: string | null; by: string | null; remarks: string | null; checks: boolean[] }[];
  damage: { id: string; date: string; severity: DamageSeverity; description: string; by: string | null; location: string | null; notes: string | null; attachments: { id: string; fileName: string }[] }[];
  osUpdates: { id: string; date: string; version: string | null; by: string | null; notes: string | null }[];
  audit: { id: string; at: string; user: string | null; action: string; message: string }[] | null;
  legacy: Record<string, unknown> | null;
};

const CHECK_LABELS = ["Present", "Serial", "Asset no.", "Location", "Assignment", "Condition"];
const dash = <span className="text-slate-300">—</span>;
const d = (v: string | null) => (v ? formatDate(v) : dash);

function Count({ n }: { n: number }) {
  return <span className="ml-0.5 rounded bg-slate-200/80 px-1.5 text-[10.5px] font-semibold text-slate-600">{n}</span>;
}

function renderLegacy(value: unknown): React.ReactNode {
  if (!value || typeof value !== "object") return String(value ?? "");
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="flex gap-2 text-[12.5px]">
          <dt className="shrink-0 text-slate-400">{k}:</dt>
          <dd className="break-all text-slate-800">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AssetHistoryTabs({ movements, repairs, verifications, damage, osUpdates, audit, legacy }: Props) {
  const legacySheets = (legacy?.legacySheets as { sheet: string; row: number; raw: Record<string, unknown> }[] | undefined) ?? [];
  return (
    <Card className="overflow-hidden">
      <Tabs defaultValue="movements">
        <div className="border-b px-3 pt-3 pb-2.5">
          <TabsList>
            <TabsTrigger value="movements" data-testid="tab-movements"><History /> Movement history <Count n={movements.length} /></TabsTrigger>
            <TabsTrigger value="repairs" data-testid="tab-repairs"><Wrench /> Repairs <Count n={repairs.length} /></TabsTrigger>
            <TabsTrigger value="verifications" data-testid="tab-verifications"><ShieldCheck /> Verifications <Count n={verifications.length} /></TabsTrigger>
            <TabsTrigger value="damage"><TriangleAlert /> Damage <Count n={damage.length} /></TabsTrigger>
            <TabsTrigger value="os"><RefreshCw /> OS updates <Count n={osUpdates.length} /></TabsTrigger>
            {audit && <TabsTrigger value="audit"><ScrollText /> Audit trail</TabsTrigger>}
            {legacy && <TabsTrigger value="legacy"><FileSpreadsheet /> Original Excel data</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="movements" className="mt-0">
          <Table data-testid="movement-history">
            <THead><TR><TH>Date</TH><TH>Action</TH><TH>From</TH><TH>To</TH><TH>Assigned to</TH><TH>Status after</TH><TH>Done by</TH><TH>Notes</TH></TR></THead>
            <TBody>
              {movements.length === 0 ? <EmptyRow colSpan={8}>No movements recorded.</EmptyRow> : movements.map((m) => (
                <TR key={m.id} data-testid="movement-row">
                  <TD className="whitespace-nowrap tabular">{formatDate(m.date)}</TD>
                  <TD><ActionBadge action={m.action} /></TD>
                  <TD>{m.from ?? dash}</TD>
                  <TD>{m.to ?? dash}</TD>
                  <TD>{m.assignedTo ?? dash}</TD>
                  <TD>{m.statusAfter ?? dash}</TD>
                  <TD className="whitespace-nowrap text-slate-600">{m.doneBy ?? dash}</TD>
                  <TD className="max-w-xs text-slate-600">{m.notes ?? dash}{m.source === "IMPORT" && <Badge color="gray" className="ml-1.5">imported</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="repairs" className="mt-0">
          <Table data-testid="repair-history">
            <THead><TR><TH>Repair date</TH><TH>Problem</TH><TH>Repair action</TH><TH>Vendor / technician</TH><TH className="text-right">Cost</TH><TH>Return date</TH><TH>Status</TH><TH>Remarks</TH></TR></THead>
            <TBody>
              {repairs.length === 0 ? <EmptyRow colSpan={8}>No repairs recorded.</EmptyRow> : repairs.map((r) => (
                <TR key={r.id} data-testid="repair-row">
                  <TD className="whitespace-nowrap tabular">{d(r.out)}</TD>
                  <TD className="max-w-[14rem]">{r.problem ?? dash}</TD>
                  <TD className="max-w-[16rem]">{[r.description, r.parts && `Parts: ${r.parts}`].filter(Boolean).join(" — ") || dash}</TD>
                  <TD>{r.technician ?? dash}</TD>
                  <TD className="text-right tabular">{r.cost !== null ? r.cost.toFixed(2) : dash}</TD>
                  <TD className="whitespace-nowrap tabular">{d(r.in)}</TD>
                  <TD><Badge color={r.status === "OPEN" ? "orange" : r.status === "COMPLETED" ? "green" : "red"}>{REPAIR_STATUS_LABELS[r.status]}</Badge></TD>
                  <TD className="max-w-[14rem] whitespace-pre-line text-slate-600">{r.notes ?? dash}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="verifications" className="mt-0">
          <Table>
            <THead><TR><TH>Date</TH><TH>Result</TH><TH>Checks</TH><TH>Physical location</TH><TH>Assigned user</TH><TH>Condition</TH><TH>Verified by</TH><TH>Remarks</TH></TR></THead>
            <TBody>
              {verifications.length === 0 ? <EmptyRow colSpan={8}>Never verified.</EmptyRow> : verifications.map((v) => (
                <TR key={v.id}>
                  <TD className="whitespace-nowrap tabular">{formatDate(v.date)}</TD>
                  <TD><Badge color={v.result === "VERIFIED" ? "green" : v.result === "DISCREPANCY" ? "orange" : "red"}>{VERIFICATION_RESULT_LABELS[v.result]}</Badge></TD>
                  <TD>
                    <div className="flex gap-1">
                      {v.checks.map((c, i) => (
                        <span key={i} title={CHECK_LABELS[i]} className={c ? "grid size-5 place-items-center rounded bg-emerald-50 text-emerald-600" : "grid size-5 place-items-center rounded bg-slate-100 text-slate-400"}>
                          {c ? <Check className="size-3" /> : <Minus className="size-3" />}
                        </span>
                      ))}
                    </div>
                  </TD>
                  <TD>{v.location ?? dash}</TD>
                  <TD>{v.assigned ?? dash}</TD>
                  <TD>{v.condition ?? dash}</TD>
                  <TD>{v.by ?? dash}</TD>
                  <TD className="text-slate-600">{v.remarks ?? dash}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="damage" className="mt-0">
          <Table>
            <THead><TR><TH>Date</TH><TH>Severity</TH><TH>Description</TH><TH>Reported by</TH><TH>Location</TH><TH>Photos</TH><TH>Notes</TH></TR></THead>
            <TBody>
              {damage.length === 0 ? <EmptyRow colSpan={7}>No damage reported.</EmptyRow> : damage.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap tabular">{formatDate(r.date)}</TD>
                  <TD><Badge color={SEVERITY_COLORS[r.severity]}>{SEVERITY_LABELS[r.severity]}</Badge></TD>
                  <TD className="max-w-xs">{r.description}</TD>
                  <TD>{r.by ?? dash}</TD>
                  <TD>{r.location ?? dash}</TD>
                  <TD>{r.attachments.length ? r.attachments.map((a) => <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" className="mr-2 inline-flex items-center gap-1 text-primary hover:underline"><Paperclip className="size-3" />{a.fileName}</a>) : dash}</TD>
                  <TD className="text-slate-600">{r.notes ?? dash}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        <TabsContent value="os" className="mt-0">
          <Table>
            <THead><TR><TH>Update date</TH><TH>OS version</TH><TH>Updated by</TH><TH>Notes</TH></TR></THead>
            <TBody>
              {osUpdates.length === 0 ? <EmptyRow colSpan={4}>No OS updates recorded.</EmptyRow> : osUpdates.map((o) => (
                <TR key={o.id}><TD className="tabular">{formatDate(o.date)}</TD><TD>{o.version ?? dash}</TD><TD>{o.by ?? dash}</TD><TD className="text-slate-600">{o.notes ?? dash}</TD></TR>
              ))}
            </TBody>
          </Table>
        </TabsContent>

        {audit && (
          <TabsContent value="audit" className="mt-0">
            <Table>
              <THead><TR><TH>When</TH><TH>User</TH><TH>Action</TH><TH>Change</TH></TR></THead>
              <TBody>
                {audit.length === 0 ? <EmptyRow colSpan={4}>No audit entries.</EmptyRow> : audit.map((l) => (
                  <TR key={l.id}><TD className="whitespace-nowrap tabular text-slate-600">{formatDateTime(l.at)}</TD><TD className="whitespace-nowrap">{l.user ?? "System"}</TD><TD><Badge color="gray">{l.action}</Badge></TD><TD>{l.message}</TD></TR>
                ))}
              </TBody>
            </Table>
          </TabsContent>
        )}

        {legacy && (
          <TabsContent value="legacy" className="mt-0 space-y-4 p-5">
            <p className="text-[12.5px] text-muted-foreground">Values exactly as they appeared in the workbook at migration time (preserved for reference; not editable).</p>
            {legacy.register ? (
              <div>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Asset Register row</div>
                {renderLegacy(legacy.register)}
              </div>
            ) : null}
            {legacySheets.map((l) => (
              <div key={`${l.sheet}-${l.row}`}>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{l.sheet} — row {l.row}</div>
                {renderLegacy(l.raw)}
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}
