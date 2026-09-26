import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { PageHeader } from "@/components/shared/misc";
import { SettingsForm } from "@/components/admin/settings-form";
import { StatusesManager, LookupsManager } from "@/components/admin/reference-lists";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const [settings, statuses, lookups] = await Promise.all([
    getSettings(),
    prisma.status.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { assets: true } } } }),
    prisma.lookupValue.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organisation details, verification rules and the option lists used throughout the system." />
      <SettingsForm initial={settings} />
      <StatusesManager rows={statuses.map((s) => ({ id: s.id, name: s.name, code: s.code, color: s.color, active: s.active, count: s._count.assets }))} />
      <LookupsManager rows={lookups.map((l) => ({ id: l.id, category: l.category, value: l.value, active: l.active }))} />
    </div>
  );
}
