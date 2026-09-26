import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { assertPermission, AuthError, type CurrentUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Business-rule violation that should be shown to the user verbatim. */
export class DomainError extends Error {
  fieldErrors?: Record<string, string>;
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Wrap a server action with: authentication, permission check, zod input validation,
 * and uniform error handling. Keeps every mutation consistent.
 */
export function defineAction<S extends z.ZodTypeAny, T>(
  permission: Permission,
  schema: S,
  handler: (input: z.infer<S>, user: CurrentUser) => Promise<T>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    try {
      const user = await assertPermission(permission);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".");
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
      }
      const data = await handler(parsed.data, user);
      return { ok: true, data };
    } catch (e) {
      return toActionError(e);
    }
  };
}

export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof DomainError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof AuthError) return { ok: false, error: e.message };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return { ok: false, error: "A record with the same unique value already exists." };
  }
  console.error("[action error]", e);
  return { ok: false, error: "Something went wrong. Please try again." };
}
