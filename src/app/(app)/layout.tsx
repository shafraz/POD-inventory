import { requireUser, SESSION_IDLE_MINUTES } from "@/lib/auth/session";
import { permissionsFor } from "@/lib/auth/permissions";
import { getReferenceData } from "@/lib/services/reference";
import { getSettings } from "@/lib/services/settings";
import { AppShell } from "@/components/app/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [ref, settings] = await Promise.all([getReferenceData(), getSettings()]);
  return (
    <AppShell user={user} permissions={permissionsFor(user.role)} refData={ref} settings={settings} idleMinutes={SESSION_IDLE_MINUTES}>
      {children}
    </AppShell>
  );
}
