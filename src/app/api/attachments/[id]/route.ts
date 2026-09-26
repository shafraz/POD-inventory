import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission, AuthError } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertPermission("asset.view");
    const { id } = await params;
    const a = await prisma.attachment.findUnique({ where: { id } });
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(a.data), {
      headers: {
        "Content-Type": a.mimeType,
        "Content-Disposition": `inline; filename="${a.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
