import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission, AuthError } from "@/lib/auth/session";
import { assetSearchWhere } from "@/lib/asset-filters";

export const runtime = "nodejs";

/** Global search: Asset ID, IMEI, serial, inventory/asset numbers, device name, location, assignee. */
export async function GET(req: Request) {
  try {
    await assertPermission("asset.view");
    const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
    if (q.length < 2) return NextResponse.json({ results: [], total: 0 });
    const where = { archived: false, ...assetSearchWhere(q) };
    const [total, rows] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        take: 12,
        orderBy: { assetId: "asc" },
        select: {
          assetId: true, deviceName: true, imei: true, serialNumber: true, inventoryNumber: true, assetNumber: true, assignedTo: true,
          assetType: { select: { name: true } }, location: { select: { name: true } }, status: { select: { name: true, color: true } },
        },
      }),
    ]);
    // Exact identifier hits first (e.g. scanning or pasting an IMEI)
    const exact = (r: (typeof rows)[number]) =>
      [r.assetId, r.imei, r.serialNumber, r.inventoryNumber, r.assetNumber].some((v) => v && v.toLowerCase() === q.toLowerCase()) ? 0 : 1;
    rows.sort((a, b) => exact(a) - exact(b));
    return NextResponse.json({
      total,
      results: rows.map((r) => ({
        assetId: r.assetId, deviceName: r.deviceName, type: r.assetType.name, location: r.location?.name ?? null,
        status: r.status.name, statusColor: r.status.color, identifier: r.imei || r.serialNumber, inventoryNumber: r.inventoryNumber,
        assetNumber: r.assetNumber, assignedTo: r.assignedTo,
      })),
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
