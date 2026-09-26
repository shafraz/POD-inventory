import Link from "next/link";
import { AlertOctagon, CalendarClock, CircleCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listAssets } from "@/lib/services/assets";
import { getDashboardData } from "@/lib/services/dashboard";
import { parseAssetFilters, filtersToQuery } from "@/lib/asset-filters";
import { PageHeader } from "@/components/shared/misc";
import { ExportMenu } from "@/components/shared/export-menu";
import { VerificationTable } from "@/components/verification/verification-table";
import { cn } from "@/lib/utils";
import type { VerificationState } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification" };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const state = (typeof sp.state === "string" && ["VERIFIED", "DUE_SOON", "OVERDUE"].includes(sp.state) ? sp.state : undefined) as VerificationState | undefined;
  const filters = { ...parseAssetFilters(sp), verification: state ? [state] : [], sort: (sp.sort as string) ?? "nextVerificationDate", pageSize: Number(sp.pageSize) || 50 };
  const [data, dash] = await Promise.all([listAssets({ ...filters, verification: state ? [state] : ["VERIFIED", "DUE_SOON", "OVERDUE"] }), getDashboardData()]);
  const v = dash.verification;
  const cards = [
    { key: "OVERDUE", label: "Overdue", sub: "Past due or never verified", value: v.overdue, icon: AlertOctagon, cls: "text-red-600", ring: "ring-red-500" },
    { key: "DUE_SOON", label: "Due soon", sub: `Within ${data.settings.dueSoonDays} days`, value: v.dueSoon, icon: CalendarClock, cls: "text-amber-600", ring: "ring-amber-500" },
    { key: "VERIFIED", label: "Verified", sub: `Within the ${data.settings.verificationIntervalDays}-day interval`, value: v.verified, icon: CircleCheck, cls: "text-emerald-600", ring: "ring-emerald-500" },
  ];
  const query = filtersToQuery({ ...filters, verification: state ? [state] : [] });

  return (
    <div>
      <PageHeader
        title="Asset Verification"
        description={`Every asset must be physically verified every ${data.settings.verificationIntervalDays} days (configurable in Settings).`}
        actions={can(user.role, "report.view") ? <ExportMenu report="verification" query={query} /> : null}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.key} href={state === c.key ? "/verification" : `/verification?state=${c.key}`} className={cn("rounded-xl border bg-card p-4 transition hover:shadow-sm", state === c.key && `ring-2 ${c.ring}`)} data-testid={`vcard-${c.key}`}>
            <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600"><c.icon className={cn("size-4", c.cls)} />{c.label}</div>
            <div className="mt-1.5 text-3xl font-semibold tabular">{c.value}</div>
            <div className="text-[12px] text-muted-foreground">{c.sub}</div>
          </Link>
        ))}
      </div>
      <VerificationTable
        state={state ?? null}
        total={data.total}
        page={filters.page ?? 1}
        pageSize={filters.pageSize}
        q={filters.q ?? ""}
        typeFilter={filters.type ?? []}
        locationFilter={filters.location ?? []}
        rows={data.rows.map((a) => ({
          id: a.id, assetId: a.assetId, deviceName: a.deviceName, type: a.assetType.name, location: a.location?.name ?? null, assignedTo: a.assignedTo,
          status: a.status.name, statusColor: a.status.color, last: a.lastVerificationDate?.toISOString() ?? null, next: a.nextVerificationDate?.toISOString() ?? null, state: a.verification,
        }))}
      />
    </div>
  );
}
