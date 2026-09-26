import Link from "next/link";
import {
  Boxes, CircleCheck, Package, Wrench, TriangleAlert, HelpCircle, CalendarClock, AlertOctagon, ChevronRight, SearchX, ClipboardList, Inbox,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/services/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR, EmptyRow } from "@/components/ui/table";
import { ActionBadge } from "@/components/shared/misc";
import { DashboardCharts } from "@/components/dashboard/charts";
import { QuickActionTiles } from "@/components/dashboard/quick-action-tiles";
import { cn, formatDate, APP_TIMEZONE } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: APP_TIMEZONE }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await getDashboardData();
  const id = d.statusIdByCode;

  const kpis = [
    { label: "Total Devices", value: d.kpis.total, icon: Boxes, tone: "text-slate-700 bg-slate-100", href: "/assets", note: "excl. disposed" },
    { label: "In Use", value: d.kpis.inUse, icon: CircleCheck, tone: "text-emerald-700 bg-emerald-50", href: `/assets?status=${id.IN_USE}` },
    { label: "In Stock", value: d.kpis.inStock, icon: Package, tone: "text-blue-700 bg-blue-50", href: `/assets?status=${id.IN_STOCK}` },
    { label: "Under Repair", value: d.kpis.underRepair, icon: Wrench, tone: "text-orange-700 bg-orange-50", href: `/assets?status=${id.UNDER_REPAIR}` },
    { label: "Damaged", value: d.kpis.damaged, icon: TriangleAlert, tone: "text-red-700 bg-red-50", href: `/assets?status=${id.DAMAGED}` },
    { label: "Unverified", value: d.kpis.unverified, icon: HelpCircle, tone: "text-violet-700 bg-violet-50", href: `/assets?status=${id.UNVERIFIED}` },
    { label: "Verification Due", value: d.kpis.verificationDue, icon: CalendarClock, tone: "text-amber-700 bg-amber-50", href: "/verification?state=OVERDUE" },
  ];

  const alerts = [
    { show: d.verification.overdue > 0, sev: "red", icon: AlertOctagon, text: `${d.verification.overdue} asset${d.verification.overdue === 1 ? "" : "s"} overdue for verification`, href: "/verification?state=OVERDUE" },
    { show: d.verification.dueSoon > 0, sev: "amber", icon: CalendarClock, text: `${d.verification.dueSoon} due for verification within ${d.settings.dueSoonDays} days`, href: "/verification?state=DUE_SOON" },
    { show: d.kpis.underRepair > 0, sev: "red", icon: Wrench, text: `${d.kpis.underRepair} asset${d.kpis.underRepair === 1 ? "" : "s"} under repair`, href: "/repairs?status=OPEN" },
    { show: d.kpis.lost > 0, sev: "red", icon: SearchX, text: `${d.kpis.lost} lost asset${d.kpis.lost === 1 ? "" : "s"}`, href: `/assets?status=${id.LOST}` },
    { show: d.kpis.damaged > 0, sev: "amber", icon: TriangleAlert, text: `${d.kpis.damaged} damaged asset${d.kpis.damaged === 1 ? "" : "s"}`, href: `/assets?status=${id.DAMAGED}` },
    { show: d.kpis.unverified > 0, sev: "amber", icon: HelpCircle, text: `${d.kpis.unverified} asset${d.kpis.unverified === 1 ? "" : "s"} with status Unverified`, href: `/assets?status=${id.UNVERIFIED}` },
    { show: d.needsReview > 0, sev: "amber", icon: ClipboardList, text: `${d.needsReview} imported record${d.needsReview === 1 ? "" : "s"} flagged for review`, href: "/assets?review=1" },
    { show: d.pendingRequests > 0, sev: "amber", icon: Inbox, text: `${d.pendingRequests} pending movement / repair request${d.pendingRequests === 1 ? "" : "s"}`, href: "/movements?tab=requests" },
  ].filter((a) => a.show);

  return (
    <div className="space-y-5">
      {sp.denied && <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">You don’t have access to that page.</div>}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Device Inventory</div>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-900">{greeting()}, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="text-[12.5px] text-muted-foreground">
          {d.settings.organizationName} · verification every {d.settings.verificationIntervalDays} days · live figures
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" data-testid="kpis">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group rounded-xl border bg-card p-4 transition hover:border-slate-300 hover:shadow-sm" data-testid={`kpi-${k.label.replace(/\s+/g, "-").toLowerCase()}`}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-slate-500">{k.label}</span>
              <span className={cn("grid size-7 place-items-center rounded-md", k.tone)}><k.icon className="size-3.5" /></span>
            </div>
            <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-slate-900 tabular" data-testid="kpi-value">{k.value}</div>
            {k.note && <div className="mt-1.5 text-[11px] text-slate-400">{k.note}</div>}
          </Link>
        ))}
      </div>

      <QuickActionTiles />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Asset overview</CardTitle>
              <CardDescription>Current status by asset type</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH>Asset type</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">In use</TH>
                <TH className="text-right">In stock</TH>
                <TH className="text-right">Repair</TH>
                <TH className="text-right">Damaged</TH>
                <TH className="text-right">Unverified</TH>
                <TH className="text-right">Other</TH>
              </TR>
            </THead>
            <TBody className="tabular">
              {d.typeOverview.map((t) => (
                <TR key={t.id}>
                  <TD><Link href={`/assets?type=${t.id}`} className="font-medium text-slate-900 hover:text-primary">{t.name}</Link></TD>
                  <TD className="text-right font-semibold">{t.total}</TD>
                  <TD className="text-right">{t.inUse}</TD>
                  <TD className="text-right">{t.inStock}</TD>
                  <TD className="text-right">{t.underRepair || <span className="text-slate-300">0</span>}</TD>
                  <TD className="text-right">{t.damaged || <span className="text-slate-300">0</span>}</TD>
                  <TD className="text-right">{t.unverified || <span className="text-slate-300">0</span>}</TD>
                  <TD className="text-right">{t.other || <span className="text-slate-300">0</span>}</TD>
                </TR>
              ))}
              <TR className="bg-slate-50/80 font-semibold">
                <TD>Total</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.total, 0)}</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.inUse, 0)}</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.inStock, 0)}</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.underRepair, 0)}</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.damaged, 0)}</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.unverified, 0)}</TD>
                <TD className="text-right">{d.typeOverview.reduce((n, t) => n + t.other, 0)}</TD>
              </TR>
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Attention required</CardTitle>
              <CardDescription>Click an item to open the filtered list</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2" data-testid="attention">
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-3 text-[13px] text-emerald-800"><CircleCheck className="size-4" /> Nothing needs attention right now.</div>
            ) : (
              alerts.map((a) => (
                <Link key={a.text} href={a.href} className={cn("flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[13px] transition hover:shadow-sm", a.sev === "red" ? "border-red-100 bg-red-50/60 text-red-900 hover:bg-red-50" : "border-amber-100 bg-amber-50/60 text-amber-900 hover:bg-amber-50")}>
                  <span className={cn("size-2 shrink-0 rounded-full", a.sev === "red" ? "bg-red-500" : "bg-amber-500")} />
                  <a.icon className={cn("size-4 shrink-0", a.sev === "red" ? "text-red-600" : "text-amber-600")} />
                  <span className="flex-1 font-medium">{a.text}</span>
                  <ChevronRight className="size-4 opacity-50" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <DashboardCharts
        typeOverview={d.typeOverview.map((t) => ({ id: t.id, name: t.name, total: t.total }))}
        statusChart={d.statusChart}
        locationChart={d.locationChart}
        typeNames={d.typeNames}
        verification={d.verification}
        dueSoonDays={d.settings.dueSoonDays}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent movements</CardTitle>
            <CardDescription>Latest transactions across all assets</CardDescription>
          </div>
          <Link href="/movements" className="text-[13px] font-medium text-primary hover:underline">View all</Link>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Date</TH><TH>Asset ID</TH><TH>Device</TH><TH>Action</TH><TH>From</TH><TH>To</TH><TH>Assigned to</TH><TH>Done by</TH>
            </TR>
          </THead>
          <TBody>
            {d.recent.length === 0 ? (
              <EmptyRow colSpan={8}>No movements recorded yet.</EmptyRow>
            ) : (
              d.recent.map((m) => (
                <TR key={m.id}>
                  <TD className="whitespace-nowrap tabular">{formatDate(m.date)}</TD>
                  <TD><Link href={`/assets/${encodeURIComponent(m.assetId)}`} className="font-mono font-semibold text-primary hover:underline">{m.assetId}</Link></TD>
                  <TD className="text-slate-600">{m.device}</TD>
                  <TD><ActionBadge action={m.action} /></TD>
                  <TD>{m.from ?? "—"}</TD>
                  <TD>{m.to ?? "—"}</TD>
                  <TD>{m.assignedTo ?? "—"}</TD>
                  <TD className="text-slate-600">{m.doneBy ?? "—"}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
