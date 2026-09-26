"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RequestType, RequestStatus } from "@prisma/client";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Textarea } from "@/components/ui/primitives";
import { useApp, type OperationKind } from "@/components/app/app-context";
import { rejectRequestAction } from "@/app/actions/operations";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

type Row = {
  id: string; type: RequestType; status: RequestStatus; createdAt: string; notes: string | null; payload: Record<string, string | null>;
  asset: { id: string; assetId: string; deviceName: string | null; location: string | null; status: string; statusColor: string };
  requestedBy: string; reviewedBy: string | null; reviewNote: string | null;
};

const KIND: Record<RequestType, OperationKind> = { ISSUE: "ISSUE", TRANSFER: "TRANSFER", RETURN: "RETURN", REPAIR: "REPAIR_OUT" };

export function RequestsTable({ rows, reviewer, showAll }: { rows: Row[]; reviewer: boolean; showAll: boolean }) {
  const { openOperation, ref } = useApp();
  const router = useRouter();
  const [rejecting, setRejecting] = React.useState<Row | null>(null);
  const [note, setNote] = React.useState("");
  const [pending, start] = React.useTransition();
  const locName = (id: string | null) => ref.locations.find((l) => l.id === id)?.name;

  const approve = (r: Row) =>
    openOperation({
      kind: KIND[r.type],
      assetId: r.asset.id,
      requestId: r.id,
      prefill: {
        toLocationId: r.payload.toLocationId ?? undefined,
        assignedTo: r.payload.assignedTo ?? undefined,
        staffId: r.payload.staffId ?? undefined,
        shift: r.payload.shift ?? undefined,
        reportedProblem: r.payload.problem ?? undefined,
        notes: [r.notes, `Requested by ${r.requestedBy}`].filter(Boolean).join(" — "),
      },
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5 text-[13px]">
        <span className="text-muted-foreground">{reviewer ? "Requests raised by Operations Users. Actioning a request records the movement." : "Your requests"}</span>
        <Link href={showAll ? "/movements?tab=requests" : "/movements?tab=requests&all=1"} className="font-medium text-primary hover:underline">{showAll ? "Pending only" : "Show all"}</Link>
      </div>
      <Table>
        <THead><TR><TH>Raised</TH><TH>Type</TH><TH>Asset</TH><TH>Details</TH><TH>Requested by</TH><TH>Status</TH>{reviewer && <TH className="text-right">Action</TH>}</TR></THead>
        <TBody>
          {rows.length === 0 ? <EmptyRow colSpan={reviewer ? 7 : 6}>No requests.</EmptyRow> : rows.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-slate-600">{formatDateTime(r.createdAt)}</TD>
              <TD><Badge color={r.type === "REPAIR" ? "orange" : "blue"}>{REQUEST_TYPE_LABELS[r.type]}</Badge></TD>
              <TD>
                <Link href={`/assets/${encodeURIComponent(r.asset.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{r.asset.assetId}</Link>
                <div className="text-[12px] text-slate-500">{r.asset.deviceName} · {r.asset.location ?? "—"} · <Badge color={r.asset.statusColor}>{r.asset.status}</Badge></div>
              </TD>
              <TD className="max-w-xs text-[12.5px]">
                {[r.payload.toLocationId && `→ ${locName(r.payload.toLocationId) ?? "?"}`, r.payload.assignedTo && `for ${r.payload.assignedTo}`, r.payload.problem, r.notes].filter(Boolean).join(" · ") || "—"}
              </TD>
              <TD>{r.requestedBy}</TD>
              <TD>
                <Badge color={r.status === "PENDING" ? "yellow" : r.status === "APPROVED" ? "green" : "red"}>{r.status.toLowerCase()}</Badge>
                {r.reviewedBy && <div className="mt-0.5 text-[11px] text-slate-400">by {r.reviewedBy}{r.reviewNote ? `: ${r.reviewNote}` : ""}</div>}
              </TD>
              {reviewer && (
                <TD className="text-right">
                  {r.status === "PENDING" && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="success" onClick={() => approve(r)}><Check /> Action</Button>
                      <Button size="sm" variant="outline" onClick={() => { setNote(""); setRejecting(r); }}><X /> Reject</Button>
                    </div>
                  )}
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject request"
        description={rejecting ? `Reject the ${rejecting.type.toLowerCase()} request for ${rejecting.asset.assetId}?` : ""}
        confirmLabel="Reject"
        destructive
        loading={pending}
        onConfirm={() => start(async () => {
          const r = await rejectRequestAction({ id: rejecting!.id, note: note || null });
          setRejecting(null);
          if (r.ok) { toast.success("Request rejected"); router.refresh(); } else toast.error(r.error);
        })}
      >
        <Textarea className="mt-3" placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      </ConfirmDialog>
    </Card>
  );
}
