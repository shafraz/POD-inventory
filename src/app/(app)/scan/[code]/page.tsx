import { redirect } from "next/navigation";

/** QR / barcode entry point: a scanned Asset ID opens the asset profile. */
export default async function ScanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/assets/${encodeURIComponent(decodeURIComponent(code).trim().toUpperCase())}`);
}
