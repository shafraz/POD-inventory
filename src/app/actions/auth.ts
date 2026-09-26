"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { auditEvent } from "@/lib/services/audit";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username").max(200),
  password: z.string().min(1, "Enter your password").max(200),
});

// Simple in-memory throttle per identifier (per server instance)
const attempts = new Map<string, { count: number; until: number }>();

export async function loginAction(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse({ identifier: formData.get("identifier"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const id = parsed.data.identifier.toLowerCase();

  const a = attempts.get(id);
  if (a && a.until > Date.now()) return { error: "Too many failed attempts. Try again in a few minutes." };

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: id, mode: "insensitive" } }, { username: { equals: id, mode: "insensitive" } }] },
  });
  const ok = user && user.active && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!ok) {
    const count = (a?.count ?? 0) + 1;
    attempts.set(id, { count, until: count >= 5 ? Date.now() + 5 * 60_000 : 0 });
    return { error: user && !user.active ? "This account is deactivated." : "Invalid email/username or password." };
  }
  attempts.delete(id);
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditEvent(prisma, { id: user.id, name: user.name, email: user.email, role: user.role }, { entityType: "User", entityId: user.id, action: "LOGIN", message: `${user.name} signed in` });
  const next = String(formData.get("next") || "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction(reason?: string) {
  const user = await getCurrentUser();
  if (user) await auditEvent(prisma, user, { entityType: "User", entityId: user.id, action: "LOGOUT", message: `${user.name} signed out${reason ? ` (${reason})` : ""}` });
  await destroySession();
  redirect(reason === "idle" ? "/login?expired=1" : "/login");
}
