import type { Prisma } from "@prisma/client";
import type { VerificationState } from "@/lib/constants";
import { addDays } from "@/lib/utils";

/**
 * Verification status is always derived from next_verification_date vs today.
 * Assets never verified (no next date) are treated as Overdue.
 */
export function verificationState(next: Date | null | undefined, today: Date, dueSoonDays: number): VerificationState {
  if (!next) return "OVERDUE";
  if (next.getTime() < today.getTime()) return "OVERDUE";
  if (next.getTime() <= addDays(today, dueSoonDays).getTime()) return "DUE_SOON";
  return "VERIFIED";
}

/** Prisma filter for a verification state (kept next to the function above so they never drift). */
export function verificationWhere(state: VerificationState, today: Date, dueSoonDays: number): Prisma.AssetWhereInput {
  const soon = addDays(today, dueSoonDays);
  switch (state) {
    case "OVERDUE":
      return { OR: [{ nextVerificationDate: null }, { nextVerificationDate: { lt: today } }] };
    case "DUE_SOON":
      return { nextVerificationDate: { gte: today, lte: soon } };
    case "VERIFIED":
      return { nextVerificationDate: { gt: soon } };
  }
}

/** Dashboard "Verification Due" = next verification date on/before today, or never verified. */
export function verificationDueWhere(today: Date): Prisma.AssetWhereInput {
  return { OR: [{ nextVerificationDate: null }, { nextVerificationDate: { lte: today } }] };
}

/** Assets that participate in verification (disposed ones do not). */
export const VERIFIABLE_WHERE: Prisma.AssetWhereInput = {
  archived: false,
  status: { code: { notIn: ["DISPOSED"] } },
};
