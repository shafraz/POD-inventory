"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, FileSpreadsheet, ListChecks, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { commitImportAction, discardImportAction } from "@/app/actions/import";
import { ISSUE_META, rowSeverity, type ImportSummary, type IssueCode, type StagedMovement, type StagedRow } from "@/lib/import/types";
import { cn } from "@/lib/utils";

const SEV_ICON = { error: AlertOctagon, warning: AlertTriangle, info: Info } as const;
const SEV_CLS = { error: "text-red-600", warning: "text-amber-600", info: "text-blue-500" } as const;
const PAGE = 100;

export function ImportReview({ batchId, status, summary, rows, movements, result }: {
  batchId: string; status: string; summary: ImportSummary; rows: StagedRow[]; movements: StagedMovement[]; result: Record<string, unknown> | null;
}) {
  const router = useRouter();
  const [include, setInclude] = React.useState<Set<string>>(() => new Set([...rows, ...movements].filter((r) => r.include).map((r) => r.key)));
  const [issueFilter, setIssueFilter] = React.useState<IssueCode | "ALL" | "CLEAN">("ALL");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<null | "selected" | "valid">(null);
  const [pending, start] = React.useTransition();
  const done = status !== "STAGED";

  const isBlocked = (r: StagedRow) => r.issues.some((i) => ISSUE_META[i.code].severity === "error" || i.code === "EXISTS_IN_DB");
  const isValid = (r: StagedRow) => !isBlocked(r) && !r.issues.some((i) => ISSUE_META[i.code].severity === "warning");
  const validKeys = rows.filter(isValid).map((r) => r.key);

  const filtered = rows.filter((r) => {
    if (issueFilter === "CLEAN" && r.issues.some((i) => ISSUE_META[i.code].severity !== "info")) return false;
    if (issueFilter !== "ALL" && issueFilter !== "CLEAN" && !r.issues.some((i) => i.code === issueFilter)) return false;
    if (q) {
      const hay = [r.data.assetId, r.data.deviceName, r.data.serialNumber, r.data.imei, r.sourceRef, r.data.locationRaw].join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const selectedAssets = rows.filter((r) => include.has(r.key) && !isBlocked(r)).length;
  const selectedFlagged = rows.filter((r) => include.has(r.key) && !isBlocked(r) && !isValid(r)).length;
  const issueEntries = (Object.entries(summary.issueCounts) as [IssueCode, number][]).sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return order[ISSUE_META[a[0]].severity] - order[ISSUE_META[b[0]].severity] || b[1] - a[1];
  });

  const commit = (keys: string[]) =>
    start(async () => {
      const r = await commitImportAction({ batchId, include: keys });
      setConfirm(null);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Imported ${r.data.assetsCreated} assets (${r.data.flaggedForReview} flagged for review)`);
      router.refresh();
    });

  if (done) {
    const r = result as { assetsCreated?: number; flaggedForReview?: number; repairsCreated?: number; movementsCreated?: number; skipped?: number; locationsCreated?: string[] } | null;
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className={cn("size-10", status === "COMMITTED" ? "text-emerald-500" : "text-slate-300")} />
          <div className="mt-3 text-lg font-semibold">{status === "COMMITTED" ? "Import completed" : "Import discarded"}</div>
          {r && (
            <p className="mt-1 max-w-lg text-[13px] text-muted-foreground">
              {r.assetsCreated} assets created · {r.flaggedForReview} flagged for review · {r.repairsCreated} repair records · {r.movementsCreated} movements · {r.skipped} rows skipped
              {r.locationsCreated?.length ? ` · new locations: ${r.locationsCreated.join(", ")}` : ""}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            {r?.flaggedForReview ? <Button asChild variant="outline"><Link href="/assets?review=1">Review flagged assets</Link></Button> : null}
            <Button asChild><Link href="/assets">Open Asset Register</Link></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><div><CardTitle>Records to import</CardTitle><CardDescription>{summary.mode === "register" ? "From the Asset Register (legacy sheets cross-checked)" : "From legacy sheets"}</CardDescription></div></CardHeader>
          <CardContent className="space-y-1.5" data-testid="import-by-type">
            {Object.entries(summary.byType).map(([t, n]) => (
              <div key={t} className="flex justify-between text-[13.5px]"><span>{t}</span><span className="font-semibold tabular">{n}</span></div>
            ))}
            <div className="flex justify-between border-t pt-1.5 text-[13.5px] font-semibold"><span>Total asset rows</span><span className="tabular">{summary.totalAssets}</span></div>
            <div className="flex justify-between text-[13px] text-muted-foreground"><span>Movement log rows</span><span className="tabular">{summary.movements}</span></div>
            <div className="pt-2 text-[12px] text-muted-foreground">
              Sheets read: {summary.sheetsFound.join(", ")}
              {summary.sheetsIgnored.length > 0 && <> · ignored: {summary.sheetsIgnored.join(", ")} (calculated live)</>}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Warnings &amp; findings</CardTitle><CardDescription>Click a finding to filter the rows below. Nothing is discarded silently.</CardDescription></div></CardHeader>
          <CardContent className="grid gap-1.5 sm:grid-cols-2" data-testid="import-warnings">
            {issueEntries.length === 0 && <div className="text-sm text-emerald-700">No issues found.</div>}
            {issueEntries.map(([code, n]) => {
              const sev = ISSUE_META[code].severity;
              const Icon = SEV_ICON[sev];
              return (
                <button key={code} onClick={() => { setIssueFilter(issueFilter === code ? "ALL" : code); setLimit(PAGE); }} className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] hover:bg-slate-50", issueFilter === code && "border-primary/50 bg-blue-50/60")}>
                  <Icon className={cn("size-4 shrink-0", SEV_CLS[sev])} />
                  <span className="flex-1">{n} × {ISSUE_META[code].label.toLowerCase()}</span>
                </button>
              );
            })}
            {summary.ignoredRows.length > 0 && (
              <div className="rounded-md bg-slate-50 px-2.5 py-1.5 text-[12.5px] text-slate-600 sm:col-span-2">
                {summary.ignoredRows.length} non-data rows skipped (legends, totals, blank template rows):{" "}
                {summary.ignoredRows.slice(0, 6).map((r) => `${r.sheet} r${r.row}`).join(", ")}{summary.ignoredRows.length > 6 ? "…" : ""}
              </div>
            )}
            {(summary.referenceAdditions.locations.length > 0 || summary.referenceAdditions.statuses.length > 0 || summary.referenceAdditions.simOperators.length > 0) && (
              <div className="rounded-md bg-blue-50 px-2.5 py-1.5 text-[12.5px] text-blue-900 sm:col-span-2">
                New reference values from “Lists”: {[...summary.referenceAdditions.locations, ...summary.referenceAdditions.statuses, ...summary.referenceAdditions.simOperators].join(", ")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="sticky top-16 z-10 border-primary/20 shadow-md">
        <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
          <div className="flex-1 text-[13px]">
            <b>{selectedAssets}</b> asset rows selected{selectedFlagged ? <> (<b>{selectedFlagged}</b> will be flagged “needs review”)</> : null} · <b>{validKeys.length}</b> rows have no warnings
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => start(async () => { await discardImportAction({ batchId }); router.push("/import"); })}><Trash2 /> Discard</Button>
            <Button variant="outline" size="sm" onClick={() => { document.getElementById("import-rows")?.scrollIntoView({ behavior: "smooth" }); }}><ListChecks /> Review issues</Button>
            <Button variant="outline" size="sm" onClick={() => setConfirm("valid")} disabled={!validKeys.length} data-testid="import-valid">Import valid records ({validKeys.length})</Button>
            <Button size="sm" onClick={() => setConfirm("selected")} disabled={!selectedAssets} data-testid="import-selected">Import selected ({selectedAssets})</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden" id="import-rows">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <Input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search rows…" className="h-8 sm:w-64" />
          <div className="flex flex-wrap gap-1.5 text-[12.5px]">
            {(["ALL", "CLEAN"] as const).map((k) => (
              <button key={k} onClick={() => setIssueFilter(k)} className={cn("rounded-full border px-2.5 py-0.5", issueFilter === k ? "border-primary bg-primary text-white" : "hover:bg-muted")}>{k === "ALL" ? "All rows" : "No warnings"}</button>
            ))}
            {issueFilter !== "ALL" && issueFilter !== "CLEAN" && <Badge color="blue">{ISSUE_META[issueFilter].label}</Badge>}
          </div>
          <div className="text-[12.5px] text-muted-foreground sm:ml-auto">{filtered.length} rows</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-9 px-3 py-2">
                  <Checkbox
                    checked={filtered.some((r) => !isBlocked(r)) && filtered.every((r) => include.has(r.key) || isBlocked(r))}
                    disabled={!filtered.some((r) => !isBlocked(r))}
                    onCheckedChange={(c) => setInclude((s) => { const n = new Set(s); filtered.forEach((r) => { if (isBlocked(r)) return; if (c) n.add(r.key); else n.delete(r.key); }); return n; })}
                  />
                </th>
                <th className="w-6" /><th className="px-2">Source</th><th className="px-2">Asset ID</th><th className="px-2">Type</th><th className="px-2">Device</th><th className="px-2">Serial / IMEI</th><th className="px-2">Location</th><th className="px-2">Status</th><th className="px-2">Findings</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((r) => {
                const sev = rowSeverity(r.issues);
                const blocked = isBlocked(r);
                const open = expanded === r.key;
                return (
                  <React.Fragment key={r.key}>
                    <tr className={cn("border-b", blocked && "bg-slate-50 text-slate-400")}>
                      <td className="px-3 py-1.5"><Checkbox disabled={blocked} checked={include.has(r.key) && !blocked} onCheckedChange={(c) => setInclude((s) => { const n = new Set(s); if (c) n.add(r.key); else n.delete(r.key); return n; })} /></td>
                      <td><button onClick={() => setExpanded(open ? null : r.key)} className="text-slate-400 hover:text-slate-700">{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</button></td>
                      <td className="whitespace-nowrap px-2 text-slate-500"><FileSpreadsheet className="mr-1 inline size-3" />{r.sourceRef}</td>
                      <td className="whitespace-nowrap px-2 font-mono font-semibold">{r.data.assetId ?? <span className="font-sans font-normal italic text-slate-400">auto</span>}</td>
                      <td className="whitespace-nowrap px-2">{r.data.typeName}</td>
                      <td className="whitespace-nowrap px-2">{r.data.deviceName ?? "—"}</td>
                      <td className="whitespace-nowrap px-2 font-mono">{r.data.imei ?? r.data.serialNumber ?? "—"}</td>
                      <td className="whitespace-nowrap px-2">{r.data.locationName ?? "—"}{r.data.locationRaw && r.data.locationRaw !== r.data.locationName && <span className="text-slate-400"> ({r.data.locationRaw})</span>}</td>
                      <td className="whitespace-nowrap px-2">{r.data.statusName}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {r.issues.filter((i) => ISSUE_META[i.code].severity !== "info" || i.code === "EXISTS_IN_DB").map((i, j) => (
                            <Badge key={j} color={ISSUE_META[i.code].severity === "error" ? "red" : ISSUE_META[i.code].severity === "warning" ? "orange" : "blue"}>{ISSUE_META[i.code].label}</Badge>
                          ))}
                          {sev === "info" && !r.issues.some((i) => i.code === "EXISTS_IN_DB") && <span className="text-slate-400">{r.issues.length} note{r.issues.length === 1 ? "" : "s"}</span>}
                          {!sev && <span className="text-emerald-600">OK</span>}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b bg-slate-50/70">
                        <td colSpan={10} className="px-10 py-3">
                          <ul className="mb-2 space-y-0.5">
                            {r.issues.map((i, j) => { const I = SEV_ICON[ISSUE_META[i.code].severity]; return <li key={j} className="flex items-center gap-1.5"><I className={cn("size-3.5", SEV_CLS[ISSUE_META[i.code].severity])} />{i.message}</li>; })}
                          </ul>
                          <div className="text-slate-500">Original values: <span className="font-mono text-[11.5px]">{JSON.stringify(r.raw)}</span></div>
                          {r.data.remarks && <div className="text-slate-500">Remarks (kept verbatim): {r.data.remarks}</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <div className="border-t p-3 text-center"><Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Show more ({filtered.length - limit} remaining)</Button></div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "valid" ? "Import valid records" : "Import selected records"}
        description={
          confirm === "valid"
            ? `Import ${validKeys.length} rows that have no warnings. Rows with warnings stay in this batch for review.`
            : `Import ${selectedAssets} asset rows${selectedFlagged ? `; ${selectedFlagged} will be flagged “needs review” on the asset` : ""}. Original values and remarks are preserved.`
        }
        confirmLabel="Import"
        loading={pending}
        onConfirm={() => commit(confirm === "valid" ? [...validKeys, ...movements.filter((m) => m.include).map((m) => m.key)] : [...include])}
      />
    </div>
  );
}
