import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flag, Paperclip, FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAssetDetail } from "@/lib/services/assets";
import { labelFor, parseTypeConfig } from "@/lib/asset-type-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoList, StatusBadge, VerificationBadge } from "@/components/shared/misc";
import { AssetActions } from "@/components/assets/asset-actions";
import { AssetHistoryTabs } from "@/components/assets/asset-history-tabs";
import { formatDate, toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ assetId: string }> }) {
  return { title: decodeURIComponent((await params).assetId) };
}

export default async function AssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const user = await requireUser();
  const code = decodeURIComponent((await params).assetId);
  const detail = await getAssetDetail(code);
  if (!detail) notFound();
  const { asset: a, verification } = detail;
  const cfg = parseTypeConfig(a.assetType.config);
  const attrs = (a.attributes ?? {}) as Record<string, unknown>;
  const openRepair = a.repairs.find((r) => r.status === "OPEN");

  const formInitial = {
    id: a.id, assetId: a.assetId, assetTypeId: a.assetTypeId, deviceName: a.deviceName ?? "", brand: a.brand ?? "", model: a.model ?? "",
    serialNumber: a.serialNumber ?? "", imei: a.imei ?? "", inventoryNumber: a.inventoryNumber ?? "", assetNumber: a.assetNumber ?? "",
    alternateReference: a.alternateReference ?? "", simOperator: a.simOperator ?? "", simNumber: a.simNumber ?? "", locationId: a.locationId ?? "",
    assignedTo: a.assignedTo ?? "", shift: a.shift ?? "", department: a.department ?? "", statusId: a.statusId, condition: a.condition ?? "",
    lastOsUpdate: toISODate(a.lastOsUpdate), osVersion: a.osVersion ?? "", lastServiceDate: toISODate(a.lastServiceDate),
    nextVerificationDate: toISODate(a.nextVerificationDate), receivedDate: toISODate(a.receivedDate), remarks: a.remarks ?? "",
    attributes: attrs as Record<string, string | number | boolean | null>,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/assets" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Asset Register</Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-2xl font-semibold tracking-tight text-slate-900" data-testid="asset-title">{a.assetId}</h1>
              <StatusBadge name={a.status.name} color={a.status.color} />
              {a.status.code !== "DISPOSED" && <VerificationBadge state={verification} />}
              {a.archived && <Badge color="dark">Archived</Badge>}
            </div>
            <p className="mt-1 text-[13.5px] text-slate-600">
              {a.assetType.name}
              {a.deviceName && <> · <span className="font-medium text-slate-800">{a.deviceName}</span></>}
              {a.location && <> · {a.location.name}</>}
              {a.assignedTo && <> · {a.assignedTo}</>}
            </p>
          </div>
          <AssetActions
            asset={{ id: a.id, assetId: a.assetId, statusCode: a.status.code, archived: a.archived, needsReview: a.needsReview, hasOs: !!cfg.hasOs || !!a.lastOsUpdate }}
            formInitial={formInitial}
            canExport={can(user.role, "report.view")}
          />
        </div>
      </div>

      {a.needsReview && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" data-testid="review-banner">
          <Flag className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <div className="font-semibold">Flagged for review during Excel migration</div>
            <div className="mt-0.5 whitespace-pre-line">{a.reviewNotes}</div>
          </div>
        </div>
      )}
      {openRepair && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] text-orange-900">
          <span className="font-semibold">At repair since {formatDate(openRepair.repairOutDate)}</span>
          {openRepair.technician && <> with {openRepair.technician}</>} — {openRepair.reportedProblem}
          {openRepair.expectedReturnDate && <> · expected back {formatDate(openRepair.expectedReturnDate)}</>}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Asset information</CardTitle></CardHeader>
          <CardContent>
            <InfoList
              className="lg:grid-cols-3"
              items={[
                { label: "Asset type", value: a.assetType.name },
                { label: labelFor(cfg, "deviceName"), value: a.deviceName },
                { label: "Brand / model", value: [a.brand, a.model].filter(Boolean).join(" · ") || null },
                { label: "IMEI", value: a.imei, mono: true },
                { label: "Serial number", value: a.serialNumber, mono: true },
                { label: labelFor(cfg, "inventoryNumber"), value: a.inventoryNumber, mono: true },
                { label: "Asset number", value: a.assetNumber, mono: true },
                { label: labelFor(cfg, "alternateReference"), value: a.alternateReference, mono: true },
                ...(cfg.hasSim || a.simOperator || a.simNumber ? [{ label: "SIM / operator", value: [a.simOperator, a.simNumber].filter(Boolean).join(" · ") || null }] : []),
                ...(cfg.extraFields ?? []).map((f) => ({ label: f.label, value: attrs[f.key] === undefined || attrs[f.key] === null ? null : f.type === "boolean" ? (attrs[f.key] ? "Yes" : "No") : String(attrs[f.key]) })),
                { label: "Received date", value: a.receivedDate ? formatDate(a.receivedDate) : null },
              ]}
            />
            {a.remarks && (
              <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px]">
                <div className="text-[11.5px] font-medium uppercase tracking-wide text-slate-400">Remarks</div>
                <div className="mt-0.5 whitespace-pre-line text-slate-800">{a.remarks}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
            <CardContent>
              <InfoList
                className="sm:grid-cols-2"
                items={[
                  { label: "Location", value: <span data-testid="detail-location">{a.location?.name ?? null}</span> },
                  { label: "Status", value: <span data-testid="detail-status">{a.status.name}</span> },
                  {
                    label: "Assigned to",
                    value: a.staff ? (
                      <Link href={`/staff/${a.staff.id}`} className="text-primary hover:underline" data-testid="detail-assigned">
                        {a.staff.name} <span className="font-mono text-xs text-muted-foreground">{a.staff.employeeNumber}</span>
                      </Link>
                    ) : (
                      <span data-testid="detail-assigned">{a.assignedTo}</span>
                    ),
                  },
                  { label: labelFor(cfg, "shift"), value: a.shift },
                  { label: "Department", value: a.department },
                  { label: "Issued date", value: a.issuedDate ? formatDate(a.issuedDate) : null },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Maintenance</CardTitle></CardHeader>
            <CardContent>
              <InfoList
                className="sm:grid-cols-2"
                items={[
                  { label: "Condition", value: a.condition },
                  { label: "Last service", value: a.lastServiceDate ? formatDate(a.lastServiceDate) : null },
                  { label: "Last verification", value: <span data-testid="detail-last-verified">{a.lastVerificationDate ? formatDate(a.lastVerificationDate) : "Never"}</span> },
                  { label: "Next verification", value: <span data-testid="detail-next-verification">{a.nextVerificationDate ? formatDate(a.nextVerificationDate) : "Due now"}</span> },
                  ...(cfg.hasOs || a.lastOsUpdate ? [{ label: "Last OS update", value: a.lastOsUpdate ? formatDate(a.lastOsUpdate) : null }, { label: "OS version", value: a.osVersion }] : []),
                ]}
              />
            </CardContent>
          </Card>
          {a.attachments.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {a.attachments.map((f) => (
                  <a key={f.id} href={`/api/attachments/${f.id}`} target="_blank" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-primary hover:bg-slate-50">
                    <Paperclip className="size-3.5" /> {f.fileName}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
          {a.source === "IMPORT" && (
            <div className="flex items-center gap-2 px-1 text-[12px] text-muted-foreground"><FileSpreadsheet className="size-3.5" /> Migrated from Excel ({a.sourceRef})</div>
          )}
        </div>
      </div>

      <AssetHistoryTabs
        movements={a.movements.map((m) => ({ id: m.id, date: m.date.toISOString(), action: m.action, from: m.fromLocation, to: m.toLocation, assignedTo: m.assignedTo, statusAfter: m.statusAfter, doneBy: m.doneBy ?? m.recordedBy?.name ?? null, notes: [m.reason, m.notes].filter(Boolean).join(" — ") || null, source: m.source }))}
        repairs={a.repairs.map((r) => ({ id: r.id, status: r.status, out: r.repairOutDate?.toISOString() ?? null, problem: r.reportedProblem, technician: r.technician, expected: r.expectedReturnDate?.toISOString() ?? null, in: r.repairInDate?.toISOString() ?? null, description: r.repairDescription, parts: r.partsReplaced, cost: r.cost ? Number(r.cost) : null, notes: r.notes }))}
        verifications={a.verifications.map((v) => ({ id: v.id, date: v.verificationDate.toISOString(), result: v.result, location: v.physicalLocation, assigned: v.assignedUser, condition: v.condition, by: v.verifiedBy, remarks: v.remarks, checks: [v.devicePresent, v.serialConfirmed, v.assetNumberConfirmed, v.locationMatches, v.assignmentMatches, v.conditionChecked] }))}
        damage={a.damageReports.map((d) => ({ id: d.id, date: d.date.toISOString(), severity: d.severity, description: d.description, by: d.reportedBy, location: d.location, notes: d.notes, attachments: d.attachments }))}
        osUpdates={a.osUpdates.map((o) => ({ id: o.id, date: o.updateDate.toISOString(), version: o.osVersion, by: o.updatedBy, notes: o.notes }))}
        audit={can(user.role, "audit.view") ? a.auditLogs.map((l) => ({ id: l.id, at: l.createdAt.toISOString(), user: l.userName, action: l.action, message: l.message })) : null}
        legacy={a.legacyData as Record<string, unknown> | null}
      />
    </div>
  );
}
