import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { LoginForm } from "./login-form";
import { Boxes, ShieldCheck, Radio, Tablet, Monitor } from "lucide-react";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between p-12">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative flex items-center gap-3">
          {s.logo ? <img src={s.logo} alt="" className="size-10 rounded-lg bg-white object-contain p-1" /> : <div className="grid size-10 place-items-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary"><Boxes className="size-5" /></div>}
          <div>
            <div className="text-sm font-semibold">{s.organizationName}</div>
            <div className="text-xs text-sidebar-muted">{s.systemName}</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">Operational equipment, accounted for.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sidebar-foreground">
            Register, assign, move, repair and verify every tablet, PC and VHF radio — with a complete history behind each one.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-xs text-sidebar-foreground">
            {[{ i: Tablet, t: "Tablets" }, { i: Monitor, t: "PCs" }, { i: Radio, t: "VHF radios" }].map(({ i: Icon, t }) => (
              <div key={t} className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3">
                <Icon className="mb-2 size-4 text-sidebar-primary" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-sidebar-muted">
          <ShieldCheck className="size-4" /> Access is restricted to authorised staff. All activity is audited.
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-sidebar text-sidebar-primary"><Boxes className="size-5" /></div>
            <div className="text-sm font-semibold">{s.systemName}</div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your email or username.</p>
          {sp.expired && (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">Your session expired due to inactivity. Please sign in again.</div>
          )}
          <LoginForm next={sp.next} />
        </div>
      </div>
    </div>
  );
}
