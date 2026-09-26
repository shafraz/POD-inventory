import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseTypeConfig } from "@/lib/asset-type-config";
import { PageHeader } from "@/components/shared/misc";
import { AssetTypesManager } from "@/components/admin/asset-types-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Asset Types" };

export default async function AssetTypesPage() {
  await requirePagePermission("reference.manage");
  const types = await prisma.assetType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { assets: { where: { archived: false } } } } },
  });
  return (
    <div>
      <PageHeader title="Asset Types" description="Each type has an Asset ID prefix and its own extra fields. New tablet models or device classes are added here — no code changes." />
      <AssetTypesManager rows={types.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, description: t.description, active: t.active, config: parseTypeConfig(t.config), count: t._count.assets }))} />
    </div>
  );
}
