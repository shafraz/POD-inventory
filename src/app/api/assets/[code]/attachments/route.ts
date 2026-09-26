import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission, AuthError } from "@/lib/auth/session";
import { auditEvent } from "@/lib/services/audit";

export const runtime = "nodejs";

/** Attach a photo / document to an asset (stored in the database). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await assertPermission("asset.edit");
    const { code } = await params;
    const asset = await prisma.asset.findUnique({ where: { assetId: decodeURIComponent(code) } });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Max 5 MB" }, { status: 400 });
    if (!/^image\/|application\/pdf/.test(file.type)) return NextResponse.json({ error: "Only images or PDF" }, { status: 400 });
    const att = await prisma.attachment.create({
      data: { assetId: asset.id, fileName: file.name.slice(0, 200), mimeType: file.type, size: file.size, data: new Uint8Array(await file.arrayBuffer()), uploadedBy: user.name },
    });
    await auditEvent(prisma, user, { entityType: "Asset", action: "ATTACHMENT", asset, message: `Attachment "${att.fileName}" added to ${asset.assetId}` });
    return NextResponse.json({ id: att.id });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
