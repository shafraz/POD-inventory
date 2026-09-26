import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/constants";
import { can, type Permission } from "./permissions";

const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES || 60);
const MAX_HOURS = Number(process.env.SESSION_MAX_HOURS || 12);

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export class AuthError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthError";
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a DB-backed session and set an httpOnly cookie holding the random token. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAX_HOURS * 3_600_000);
  const h = await headers();
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 250) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolve the logged-in user. Sessions expire after SESSION_MAX_HOURS (absolute)
 * or SESSION_IDLE_MINUTES of inactivity (sliding).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  const idleExpired = now - session.lastSeenAt.getTime() > IDLE_MINUTES * 60_000;
  if (session.expiresAt.getTime() < now || idleExpired || !session.user.active) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Slide the idle window at most once a minute
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
});

/** For pages: redirect to /login when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages: redirect away when the role lacks a permission. */
export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}

/** For actions / API routes: throw when unauthenticated or unauthorised. */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has expired. Please sign in again.");
  if (!can(user.role, permission)) throw new AuthError();
  return user;
}

export const SESSION_IDLE_MINUTES = IDLE_MINUTES;
