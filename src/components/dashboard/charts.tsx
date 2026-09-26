"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, CalendarClock, CircleCheck, Table2, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BADGE_COLORS } from "@/components/ui/badge";
import { seriesColor, STATE_HEX } from "@/lib/chart-palette";
import { cn } from "@/lib/utils";

type Props = {
  typeOverview: { id: string; name: string; total: number }[];
  statusChart: { id: string; name: string; code: string; color: string; value: number }[];
  locationChart: { id: string; name: string; total: number; byType: Record<string, number> }[];
  typeNames: string[];
  verification: { verified: number; dueSoon: number; overdue: number };
  dueSoonDays: number;
};

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color?: string }[] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-[12px] shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">{r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}{r.label}</span>
          <span className="font-semibold tabular text-slate-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({ typeOverview, statusChart, locationChart, typeNames, verification, dueSoonDays }: Props) {
  const router = useRouter();
  const [locTable, setLocTable] = React.useState(false);
  const statusData = statusChart.filter((s) => s.value > 0);
  const statusTotal = statusData.reduce((n, s) => n + s.value, 0);
  const vTotal = verification.verified + verification.dueSoon + verification.overdue;
  const vRows = [
    { key: "VERIFIED", label: "Verified", value: verification.verified, color: STATE_HEX.VERIFIED, icon: CircleCheck },
    { key: "DUE_SOON", label: `Due soon (≤${dueSoonDays}d)`, value: verification.dueSoon, color: STATE_HEX.DUE_SOON, icon: CalendarClock },
    { key: "OVERDUE", label: "Overdue / never verified", value: verification.overdue, color: STATE_HEX.OVERDUE, icon: AlertOctagon },
  ];
  const locData = locationChart.map((l) => ({ ...l, ...l.byType }));
  const typeIndex = new Map(typeNames.map((t, i) => [t, i]));

  return (
    <div className="grid gap-5 lg:grid-cols-2" data-testid="charts">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Assets by type</CardTitle>
            <CardDescription>Registered devices, excluding disposed</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={typeOverview} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} tick={{ fontSize: 12, fill: "var(--chart-label)" }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                <Tooltip cursor={{ fill: "var(--chart-cursor)" }} content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={String(payload[0].payload.name)} rows={[{ label: "Devices", value: Number(payload[0].value) }]} /> : null)} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={56} label={{ position: "top", fontSize: 12, fill: "var(--chart-label)", fontWeight: 600 }} onClick={(d) => router.push(`/assets?type=${(d as unknown as { id: string }).id}`)} className="cursor-pointer">
                  {typeOverview.map((t, i) => <Cell key={t.id} fill={seriesColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Asset status</CardTitle>
            <CardDescription>All registered devices by current status</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-56 w-56 shrink-0">
              <PieChart width={224} height={224}>
                <Pie data={statusData} dataKey="value" nameKey="name" cx={112} cy={112} innerRadius={70} outerRadius={106} isAnimationActive={false} paddingAngle={1.5} stroke="var(--chart-gap)" strokeWidth={2} onClick={(d) => router.push(`/assets?status=${(d as unknown as { id: string }).id}`)} className="cursor-pointer">
                  {statusData.map((s) => <Cell key={s.id} fill={BADGE_COLORS[s.color]?.hex ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => (active && payload?.length ? <TooltipBox title={String(payload[0].name)} rows={[{ label: "Devices", value: Number(payload[0].value) }, { label: "% of all", value: Math.round((Number(payload[0].value) / Math.max(1, statusTotal)) * 100) }]} /> : null)} />
              </PieChart>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-2xl font-semibold tabular">{statusTotal}</div>
                <div className="text-[11px] text-muted-foreground">devices</div>
              </div>
            </div>
          </div>
          <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-1">
            {statusChart.map((s) => (
              <li key={s.id}>
                <Link href={`/assets?status=${s.id}`} className="flex items-center justify-between gap-3 rounded px-1.5 py-0.5 hover:bg-slate-50">
                  <span className="flex items-center gap-2 text-slate-600"><span className={cn("size-2.5 rounded-sm", BADGE_COLORS[s.color]?.dot)} />{s.name}</span>
                  <span className={cn("font-semibold tabular", s.value ? "text-slate-900" : "text-slate-300")}>{s.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Assets by location</CardTitle>
            <CardDescription>Stacked by asset type</CardDescription>
          </div>
          <div className="flex rounded-md border p-0.5">
            <button onClick={() => setLocTable(false)} className={cn("rounded p-1", !locTable && "bg-slate-100")} aria-label="Chart view"><BarChart3 className="size-3.5" /></button>
            <button onClick={() => setLocTable(true)} className={cn("rounded p-1", locTable && "bg-slate-100")} aria-label="Table view"><Table2 className="size-3.5" /></button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-600">
            {typeNames.map((t, i) => <span key={t} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: seriesColor(i) }} />{t}</span>)}
          </div>
          {locTable ? (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-[12.5px] tabular">
                <thead className="sticky top-0 bg-card text-slate-500"><tr><th className="py-1 text-left font-medium">Location</th>{typeNames.map((t) => <th key={t} className="py-1 text-right font-medium">{t}</th>)}<th className="py-1 text-right font-medium">Total</th></tr></thead>
                <tbody>
                  {locationChart.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="py-1"><Link className="hover:text-primary" href={`/assets?location=${l.id}`}>{l.name}</Link></td>
                      {typeNames.map((t) => <td key={t} className="py-1 text-right">{l.byType[t] ?? 0}</td>)}
                      <td className="py-1 text-right font-semibold">{l.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ height: Math.max(220, locData.length * 26 + 30) }}>
              <ResponsiveContainer>
                <BarChart data={locData} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={5}>
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} />
                  <YAxis type="category" dataKey="name" width={104} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--chart-label)" }} />
                  <Tooltip
                    cursor={{ fill: "var(--chart-cursor)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as (typeof locData)[number];
                      return <TooltipBox title={`${row.name} · ${row.total}`} rows={typeNames.filter((t) => row.byType[t]).map((t) => ({ label: t, value: row.byType[t], color: seriesColor(typeIndex.get(t)!) }))} />;
                    }}
                  />
                  {typeNames.map((t, i) => (
                    <Bar key={t} dataKey={t} stackId="a" fill={seriesColor(i)} stroke="var(--chart-gap)" strokeWidth={1} radius={i === typeNames.length - 1 ? [0, 4, 4, 0] : 0} className="cursor-pointer" onClick={(d) => { const id = (d as unknown as { payload: { id: string } }).payload.id; router.push(`/assets?location=${id}`); }} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Verification status</CardTitle>
            <CardDescription>Against the configured verification interval</CardDescription>
          </div>
          <Link href="/verification" className="text-[13px] font-medium text-primary hover:underline">Open</Link>
        </CardHeader>
        <CardContent>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Verification status distribution">
            {vRows.map((r) => r.value > 0 && <Link key={r.key} href={`/verification?state=${r.key}`} style={{ width: `${(r.value / Math.max(1, vTotal)) * 100}%`, background: r.color }} className="h-full border-r-2 border-card last:border-0" title={`${r.label}: ${r.value}`} />)}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {vRows.map((r) => (
              <Link key={r.key} href={`/verification?state=${r.key}`} className="rounded-lg border p-3 transition hover:shadow-sm" data-testid={`verif-${r.key}`}>
                <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><r.icon className="size-3.5" style={{ color: r.color }} />{r.label}</div>
                <div className="mt-1 text-2xl font-semibold tabular text-slate-900">{r.value}</div>
                <div className="text-[11px] text-slate-400">{vTotal ? Math.round((r.value / vTotal) * 100) : 0}% of verifiable assets</div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
