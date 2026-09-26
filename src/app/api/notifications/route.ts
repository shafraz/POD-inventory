import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listNotifications, refreshVerificationNotifications, unreadCount } from "@/lib/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  await refreshVerificationNotifications();
  const [items, unread] = await Promise.all([listNotifications(user.id, user.role, 25), unreadCount(user.id, user.role)]);
  return NextResponse.json({ items, unread });
}
