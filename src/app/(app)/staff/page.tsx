import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listStaff, staffDesignations } from "@/lib/services/staff";
import { PageHeader } from "@/components/shared/misc";
import { StaffList } from "@/components/staff/staff-list";
import { ExportMenu } from "@/components/shared/export-menu";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    q: sp.q ?? "",
    shift: sp.shift ?? "",
    status: (sp.status === "inactive" || sp.status === "all" ? sp.status : "active") as "active" | "inactive" | "all",
    holding: sp.holding === "1",
  };
  const [rows, designations] = await Promise.all([listStaff(filters), staffDesignations()]);
  const query = new URLSearchParams(Object.entries({ q: filters.q, shift: filters.shift, status: sp.status ?? "", holding: sp.holding ?? "" }).filter(([, v]) => v)).toString();

  return (
    <div>
      <PageHeader
        title="Staff"
        description="People who receive and return tablets and VHF radios. Pick them when issuing or transferring a device."
        actions={can(user.role, "report.view") ? <ExportMenu report="staff" query={query} /> : null}
      />
      <StaffList
        filters={filters}
        designations={designations}
        rows={rows.map((s) => ({
          id: s.id, name: s.name, employeeNumber: s.employeeNumber, designation: s.designation ?? "", shift: s.shift ?? "",
          department: s.department ?? "", phone: s.phone ?? "", notes: s.notes ?? "", active: s.active,
          assets: s.assets.map((a) => ({ assetId: a.assetId, type: a.assetType.name })),
        }))}
      />
    </div>
  );
}
