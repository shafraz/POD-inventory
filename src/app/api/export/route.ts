import { NextResponse } from "next/server";
import { assertPermission, AuthError } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { buildReport, reportMeta, REPORTS, type ReportKey } from "@/lib/services/reports";
import { toCsv, toPdf, toXlsx } from "@/lib/export/exporters";
import { auditEvent } from "@/lib/services/audit";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * GET /api/export?report=asset-register&format=xlsx|csv|pdf&<filters>
 * Filters are the same query params used by the on-screen tables, so exports
 * always contain exactly what the user is looking at.
 */
export async function GET(req: Request) {
  try {
    const user = await assertPermission("report.view");
    const url = new URL(req.url);
    const key = (url.searchParams.get("report") || "asset-register") as ReportKey;
    const format = url.searchParams.get("format") || "xlsx";
    if (key !== "asset-record" && !REPORTS.some((r) => r.key === key)) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
    if (key === "audit" && !can(user.role, "audit.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sp: Record<string, string | string[]> = {};
    for (const k of new Set(url.searchParams.keys())) {
      const all = url.searchParams.getAll(k);
      sp[k] = all.length > 1 ? all : all[0];
    }
    const report = await buildReport(key, sp);
    const meta = await reportMeta();
    const base = `${report.title.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${todayISO()}`;
    await auditEvent(prisma, user, { entityType: "Export", action: "EXPORT", message: `${report.title} exported as ${format.toUpperCase()} (${report.subtitle.split(" · Generated")[0]})` });

    if (format === "csv") {
      return new NextResponse(toCsv(report), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
      });
    }
    if (format === "pdf") {
      const buf = toPdf(report, meta);
      return new NextResponse(new Uint8Array(buf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
      });
    }
    const buf = await toXlsx(report, meta);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    console.error(e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
