import { requireUser } from "@/lib/auth/session";
import { listAssets } from "@/lib/services/assets";
import { filtersToQuery, parseAssetFilters } from "@/lib/asset-filters";
import { PageHeader } from "@/components/shared/misc";
import { AssetRegister } from "@/components/assets/asset-register";
import { ExportMenu } from "@/components/shared/export-menu";
import { AddAssetButton } from "@/components/assets/add-asset-button";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assets" };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const filters = parseAssetFilters(await searchParams);
  const data = await listAssets(filters);
  const query = filtersToQuery(filters);

  return (
    <div>
      <PageHeader
        title="Asset Register"
        description="The current state of every tablet, PC and VHF radio. Movement history is kept on each asset."
        actions={
          <>
            {can(user.role, "report.view") && <ExportMenu report="asset-register" query={query} />}
            {can(user.role, "asset.create") && <AddAssetButton />}
          </>
        }
      />
      <AssetRegister
        rows={data.rows.map((a) => ({
          id: a.id,
          assetId: a.assetId,
          type: a.assetType.name,
          deviceName: a.deviceName,
          brand: a.brand,
          model: a.model,
          serial: a.imei || a.serialNumber,
          inventoryNumber: a.inventoryNumber,
          assetNumber: a.assetNumber,
          alternateReference: a.alternateReference,
          sim: [a.simOperator, a.simNumber].filter(Boolean).join(" / ") || null,
          location: a.location?.name ?? null,
          assignedTo: [a.assignedTo, a.shift && a.shift !== a.assignedTo ? a.shift : null].filter(Boolean).join(" · ") || null,
          status: a.status.name,
          statusColor: a.status.color,
          statusCode: a.status.code,
          lastVerificationDate: a.lastVerificationDate?.toISOString() ?? null,
          nextVerificationDate: a.nextVerificationDate?.toISOString() ?? null,
          verification: a.verification,
          lastOsUpdate: a.lastOsUpdate?.toISOString() ?? null,
          condition: a.condition,
          remarks: a.remarks,
          needsReview: a.needsReview,
        }))}
        total={data.total}
        filters={filters}
      />
    </div>
  );
}
