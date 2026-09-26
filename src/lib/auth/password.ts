import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Minimum policy: 8+ chars, at least one letter and one number. */
export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Password must contain letters and numbers.";
  return null;
}
