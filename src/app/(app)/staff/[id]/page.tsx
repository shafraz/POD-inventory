import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getStaffDetail, staffDesignations } from "@/lib/services/staff";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { ActionBadge, InfoList, StatusBadge } from "@/components/shared/misc";
import { StaffDetailActions, ReturnDeviceButton } from "@/components/staff/staff-detail-actions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [s, designations] = await Promise.all([getStaffDetail(id), staffDesignations()]);
  if (!s) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/staff" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Staff</Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900" data-testid="staff-title">{s.name}</h1>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-[13px] font-semibold">{s.employeeNumber}</span>
              {s.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Inactive</Badge>}
            </div>
            <p className="mt-1 text-[13.5px] text-slate-600">{[s.designation, s.shift, s.department].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <StaffDetailActions
            designations={designations}
            staff={{ id: s.id, name: s.name, employeeNumber: s.employeeNumber, designation: s.designation ?? "", shift: s.shift ?? "", department: s.department ?? "", phone: s.phone ?? "", notes: s.notes ?? "", active: s.active, holding: s.assets.length }}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <InfoList
              className="sm:grid-cols-1"
              items={[
                { label: "Employee number", value: s.employeeNumber, mono: true },
                { label: "Designation", value: s.designation },
                { label: "Shift", value: s.shift },
                { label: "Department", value: s.department },
                { label: "Phone", value: s.phone },
                { label: "Notes", value: s.notes },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Devices currently held</CardTitle>
              <CardDescription>{s.assets.length === 0 ? "Nothing issued to this person right now." : `${s.assets.length} device${s.assets.length === 1 ? "" : "s"} issued`}</CardDescription>
            </div>
          </CardHeader>
          <Table data-testid="held-devices">
            <THead><TR><TH>Asset ID</TH><TH>Type</TH><TH>Device</TH><TH>Location</TH><TH>Issued</TH><TH>Status</TH><TH /></TR></THead>
            <TBody>
              {s.assets.length === 0 ? (
                <EmptyRow colSpan={7}><Smartphone className="mx-auto mb-1 size-5 text-slate-300" />No devices held</EmptyRow>
              ) : (
                s.assets.map((a) => (
                  <TR key={a.id}>
                    <TD><Link href={`/assets/${encodeURIComponent(a.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{a.assetId}</Link></TD>
                    <TD>{a.assetType.name}</TD>
                    <TD>{a.deviceName ?? "—"}</TD>
                    <TD>{a.location?.name ?? "—"}</TD>
                    <TD className="whitespace-nowrap tabular">{formatDate(a.issuedDate)}</TD>
                    <TD><StatusBadge name={a.status.name} color={a.status.color} /></TD>
                    <TD className="text-right">{a.status.code !== "UNDER_REPAIR" && <ReturnDeviceButton assetId={a.id} />}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Issue &amp; return history</CardTitle>
            <CardDescription>Every device movement recorded against this person</CardDescription>
          </div>
        </CardHeader>
        <Table data-testid="staff-history">
          <THead><TR><TH>Date</TH><TH>Asset</TH><TH>Device</TH><TH>Action</TH><TH>From</TH><TH>To</TH><TH>Done by</TH><TH>Notes</TH></TR></THead>
          <TBody>
            {s.movements.length === 0 ? (
              <EmptyRow colSpan={8}>No movements recorded yet.</EmptyRow>
            ) : (
              s.movements.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap tabular">{formatDate(m.date)}</TD>
                  <TD><Link href={`/assets/${encodeURIComponent(m.asset.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{m.asset.assetId}</Link></TD>
                  <TD className="text-slate-600">{m.asset.deviceName} · {m.asset.assetType.name}</TD>
                  <TD><ActionBadge action={m.action} /></TD>
                  <TD>{m.fromLocation ?? "—"}</TD>
                  <TD>{m.toLocation ?? "—"}</TD>
                  <TD className="text-slate-600">{m.doneBy ?? "—"}</TD>
                  <TD className="max-w-xs text-slate-500">{[m.reason, m.notes].filter(Boolean).join(" — ") || "—"}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
