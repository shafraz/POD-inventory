import Link from "next/link";
import { FileBarChart, MapPin, Shapes, Wrench, TriangleAlert, SearchX, ShieldCheck, ArrowLeftRight, History, Boxes } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { buildReport, REPORTS, type ReportKey } from "@/lib/services/reports";
import { PageHeader, EmptyState } from "@/components/shared/misc";
import { Card } from "@/components/ui/card";
import { ExportMenu } from "@/components/shared/export-menu";
import { ReportFilters } from "@/components/reports/report-filters";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

const ICONS: Record<string, React.ElementType> = {
  "asset-register": Boxes, "by-location": MapPin, "by-type": Shapes, "under-repair": Wrench, damaged: TriangleAlert, lost: SearchX,
  verification: ShieldCheck, movements: ArrowLeftRight, audit: History,
};
const PREVIEW_ROWS = 150;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission("report.view");
  const sp = await searchParams;
  const available = REPORTS.filter((r) => r.key !== "audit" || can(user.role, "audit.view"));
  const key = (typeof sp.report === "string" && available.some((r) => r.key === sp.report) ? sp.report : null) as ReportKey | null;
  const def = available.find((r) => r.key === key);
  const report = key ? await buildReport(key, sp) : null;
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (k === "report" || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])))).toString();

  return (
    <div>
      <PageHeader title="Reports" description="Every report can be filtered and exported to Excel, CSV or PDF. Exports contain exactly the filtered records." />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-1">
          {available.map((r) => {
            const Icon = ICONS[r.key] ?? FileBarChart;
            return (
              <Link key={r.key} href={`/reports?report=${r.key}`} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 transition", key === r.key ? "border-primary/40 bg-blue-50/60" : "border-transparent hover:bg-card hover:shadow-sm")} data-testid={`report-${r.key}`}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", key === r.key ? "text-primary" : "text-slate-400")} />
                <div>
                  <div className="text-[13px] font-medium text-slate-900">{r.title}</div>
                  <div className="text-[11.5px] leading-snug text-muted-foreground">{r.description}</div>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">
          {!report || !def ? (
            <Card><EmptyState icon={FileBarChart} title="Choose a report" description="Select a report on the left to preview, filter and export it." /></Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">{report.title}</h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground" data-testid="report-subtitle">{report.subtitle}</p>
                </div>
                <ExportMenu report={def.key} query={query} />
              </div>
              <ReportFilters kind={def.kind} reportKey={def.key} />
              <div className="space-y-6 p-4">
                {report.sections.map((s, i) => (
                  <div key={i}>
                    {s.title && <h3 className="mb-2 text-[13px] font-semibold text-slate-800">{s.title}</h3>}
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-[12.5px]">
                        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <tr>{s.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-2.5 py-2">{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {s.rows.length === 0 ? (
                            <tr><td colSpan={s.columns.length} className="px-3 py-6 text-center text-muted-foreground">No records</td></tr>
                          ) : (
                            s.rows.slice(0, PREVIEW_ROWS).map((r, j) => (
                              <tr key={j} className="border-t">
                                {s.columns.map((c) => <td key={c.key} className="max-w-[18rem] truncate whitespace-nowrap px-2.5 py-1.5" title={r[c.key] == null ? "" : String(r[c.key])}>{r[c.key] ?? <span className="text-slate-300">—</span>}</td>)}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {s.rows.length > PREVIEW_ROWS && <p className="mt-1.5 text-[12px] text-muted-foreground">Showing first {PREVIEW_ROWS} of {s.rows.length} rows — export for the full list.</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
