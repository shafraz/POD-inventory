import { requirePagePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/shared/misc";
import { UsersManager } from "@/components/admin/users-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePagePermission("users.manage");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, username: true, role: true, active: true, lastLoginAt: true, createdAt: true },
  });
  return (
    <div>
      <PageHeader title="Users & Permissions" description="Manage who can sign in and what they can do. Passwords are stored as bcrypt hashes and never shown." />
      <UsersManager meId={me.id} rows={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))} />
    </div>
  );
}
