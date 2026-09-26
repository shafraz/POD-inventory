import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/misc";
import { LocationsManager } from "@/components/admin/locations-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  await requirePagePermission("reference.manage");
  const locations = await prisma.location.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { assets: { where: { archived: false } } } } },
  });
  return (
    <div>
      <PageHeader title="Locations" description="Locations are stored in the database — add, rename or deactivate them here. Aliases help the Excel import recognise alternative spellings." />
      <LocationsManager rows={locations.map((l) => ({ id: l.id, name: l.name, description: l.description, aliases: l.aliases, active: l.active, count: l._count.assets }))} />
    </div>
  );
}
