import { prisma, type Tx } from "@/lib/db";

export type AppSettings = {
  organizationName: string;
  systemName: string;
  logo: string | null; // data URL
  verificationIntervalDays: number;
  dueSoonDays: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  organizationName: "Maldives Ports Limited",
  systemName: "Device Inventory",
  logo: null,
  verificationIntervalDays: 90,
  dueSoonDays: 14,
};

export async function getSettings(db: Tx | typeof prisma = prisma): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...(map as Partial<AppSettings>) };
}

export async function saveSettings(patch: Partial<AppSettings>, db: Tx | typeof prisma = prisma) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });
  }
}
