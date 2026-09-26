import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission, AuthError } from "@/lib/auth/session";
import { parseWorkbook } from "@/lib/import/parse";
import { loadImportContext } from "@/lib/import/commit";

export const runtime = "nodejs";

/** Upload a workbook → parse, normalise, validate → store as a staged batch for review. */
export async function POST(req: Request) {
  try {
    const user = await assertPermission("import.run");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "Please upload an .xlsx workbook" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File is larger than 10 MB" }, { status: 400 });
    const staged = await parseWorkbook(Buffer.from(await file.arrayBuffer()), file.name, await loadImportContext());
    const batch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        summary: staged.summary as never,
        rows: { rows: staged.rows, movements: staged.movements } as never,
        createdById: user.id,
      },
    });
    return NextResponse.json({ id: batch.id });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "The workbook could not be read. Is it a valid .xlsx file?" }, { status: 422 });
  }
}
