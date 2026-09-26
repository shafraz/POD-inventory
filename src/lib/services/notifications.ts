import type { Role } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { todayDate, todayISO, addDays } from "@/lib/utils";
import { getSettings } from "./settings";
import { VERIFIABLE_WHERE } from "@/lib/verification-state";

type NotifyInput = {
  type: string;
  severity?: "info" | "warning" | "critical" | "success";
  title: string;
  message: string;
  link?: string;
  audience?: Role[];
  dedupeKey?: string;
};

export async function notify(db: Tx | typeof prisma, n: NotifyInput) {
  const data = {
    type: n.type,
    severity: n.severity ?? "info",
    title: n.title,
    message: n.message,
    link: n.link,
    audience: n.audience ?? (["ADMIN", "INVENTORY_OFFICER"] as Role[]),
    dedupeKey: n.dedupeKey,
  };
  if (n.dedupeKey) {
    await db.notification.upsert({ where: { dedupeKey: n.dedupeKey }, create: data, update: {} });
  } else {
    await db.notification.create({ data });
  }
}

let lastSweep = "";

/**
 * Daily verification sweep: raises "overdue" / "due soon" notifications once per day.
 * Called lazily (from the notification bell) so no scheduler is required.
 */
export async function refreshVerificationNotifications() {
  const day = todayISO();
  if (lastSweep === day) return;
  lastSweep = day;
  const settings = await getSettings();
  const today = todayDate();
  const [overdue, dueSoon] = await Promise.all([
    prisma.asset.count({
      where: { ...VERIFIABLE_WHERE, OR: [{ nextVerificationDate: null }, { nextVerificationDate: { lt: today } }] },
    }),
    prisma.asset.count({
      where: { ...VERIFIABLE_WHERE, nextVerificationDate: { gte: today, lte: addDays(today, settings.dueSoonDays) } },
    }),
  ]);
  if (overdue > 0) {
    await notify(prisma, {
      type: "verification_overdue",
      severity: "critical",
      title: "Verification overdue",
      message: `${overdue} asset${overdue === 1 ? "" : "s"} past the ${settings.verificationIntervalDays}-day verification date.`,
      link: "/verification?state=OVERDUE",
      dedupeKey: `verif-overdue-${day}`,
    });
  }
  if (dueSoon > 0) {
    await notify(prisma, {
      type: "verification_due_soon",
      severity: "warning",
      title: "Verification due soon",
      message: `${dueSoon} asset${dueSoon === 1 ? "" : "s"} due for verification within ${settings.dueSoonDays} days.`,
      link: "/verification?state=DUE_SOON",
      dedupeKey: `verif-soon-${day}`,
    });
  }
}

export async function listNotifications(userId: string, role: Role, take = 30) {
  const items = await prisma.notification.findMany({
    where: { audience: { has: role } },
    orderBy: { createdAt: "desc" },
    take,
    include: { reads: { where: { userId }, select: { userId: true } } },
  });
  return items.map((n) => ({
    id: n.id,
    type: n.type,
    severity: n.severity,
    title: n.title,
    message: n.message,
    link: n.link,
    createdAt: n.createdAt.toISOString(),
    read: n.reads.length > 0,
  }));
}

export async function unreadCount(userId: string, role: Role) {
  return prisma.notification.count({
    where: { audience: { has: role }, reads: { none: { userId } } },
  });
}

export async function markRead(userId: string, ids: string[] | "all", role: Role) {
  const targets =
    ids === "all"
      ? (await prisma.notification.findMany({ where: { audience: { has: role }, reads: { none: { userId } } }, select: { id: true } })).map((n) => n.id)
      : ids;
  if (!targets.length) return;
  await prisma.notificationRead.createMany({
    data: targets.map((notificationId) => ({ notificationId, userId })),
    skipDuplicates: true,
  });
}
