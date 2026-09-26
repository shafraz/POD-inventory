import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { assertPermission, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * QR code for an asset. The payload is the Asset ID only (e.g. "TAB10-032"), so labels stay
 * valid even if the server address changes. A scanner app resolves it via /scan/<Asset ID>.
 * ?format=svg|png  ?download=1
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await assertPermission("asset.view");
    const { code } = await params;
    const asset = await prisma.asset.findUnique({ where: { assetId: decodeURIComponent(code) }, select: { assetId: true } });
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "png" ? "png" : "svg";
    const disposition = url.searchParams.get("download") ? `attachment; filename="${asset.assetId}-qr.${format}"` : "inline";
    if (format === "png") {
      const buf = await QRCode.toBuffer(asset.assetId, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "M" });
      return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/png", "Content-Disposition": disposition } });
    }
    const svg = await QRCode.toString(asset.assetId, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": disposition } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
