"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  LayoutDashboard, Boxes, ArrowLeftRight, Wrench, ShieldCheck, FileBarChart, MapPin, Shapes, Users, Settings, LogOut,
  Menu, Contact, ChevronsLeft, ChevronsRight, History, FileUp, KeyRound, ChevronDown,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/constants";
import type { Permission } from "@/lib/auth/permissions";
import type { ReferenceData } from "@/lib/services/reference";
import type { AppSettings } from "@/lib/services/settings";
import { AppProvider, type OperationRequest } from "./app-context";
import { SheetContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { TooltipProvider, Tooltip } from "@/components/ui/primitives";
import { GlobalSearch } from "./global-search";
import { NotificationBell } from "./notification-bell";
import { QuickActionsMenu } from "./quick-actions";
import { IdleWatcher } from "./idle-watcher";
import { OperationDialog } from "@/components/operations/operation-dialog";
import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { ChangePasswordDialog } from "./change-password-dialog";
import { ThemeSwitcher, ThemeToggleButton } from "@/components/theme/theme";
import { logoutAction } from "@/app/actions/auth";

type NavItem = { href: string; label: string; icon: React.ElementType; perm?: Permission };

const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/staff", label: "Staff", icon: Contact },
  { href: "/movements", label: "Movement & Transfers", icon: ArrowLeftRight },
  { href: "/repairs", label: "Repairs & Damage", icon: Wrench },
  { href: "/verification", label: "Verification", icon: ShieldCheck },
  { href: "/reports", label: "Reports", icon: FileBarChart, perm: "report.view" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/locations", label: "Locations", icon: MapPin, perm: "reference.manage" },
  { href: "/asset-types", label: "Asset Types", icon: Shapes, perm: "reference.manage" },
  { href: "/users", label: "Users", icon: Users, perm: "users.manage" },
  { href: "/import", label: "Import from Excel", icon: FileUp, perm: "import.run" },
  { href: "/audit", label: "Audit Trail", icon: History, perm: "audit.view" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
];

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function SidebarContent({
  collapsed, user, permissions, settings, onNavigate,
}: { collapsed: boolean; user: { name: string; role: Role }; permissions: Permission[]; settings: AppSettings; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const visible = (items: NavItem[]) => items.filter((i) => !i.perm || permissions.includes(i.perm));
  const admin = visible(ADMIN_NAV);

  const link = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const el = (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
          active ? "bg-sidebar-accent text-white shadow-[inset_2px_0_0_var(--sidebar-primary)]" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-muted group-hover:text-sidebar-foreground")} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
    return collapsed ? <Tooltip key={item.href} content={item.label} side="right">{el}</Tooltip> : el;
  };

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        {settings.logo ? (
          <img src={settings.logo} alt="" className="size-8 shrink-0 rounded-md bg-white object-contain p-0.5" />
        ) : (
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary/15 text-sidebar-primary"><Boxes className="size-[18px]" /></div>
        )}
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold text-white">{settings.systemName}</div>
            <div className="truncate text-[11px] text-sidebar-muted">{settings.organizationName}</div>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {visible(MAIN_NAV).map(link)}
        {admin.length > 0 && (
          <>
            {!collapsed ? <div className="px-2.5 pb-1.5 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">Administration</div> : <div className="my-3 border-t border-sidebar-border" />}
            {admin.map(link)}
          </>
        )}
      </nav>
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "flex-col")}>
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-white">{initials(user.name)}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium text-white">{user.name}</div>
              <div className="truncate text-[11px] text-sidebar-muted">{ROLE_LABELS[user.role]}</div>
            </div>
          )}
          <Tooltip content="Log out" side={collapsed ? "right" : "top"}>
            <button onClick={() => logoutAction()} className="rounded-md p-1.5 text-sidebar-muted transition hover:bg-sidebar-accent hover:text-white" aria-label="Log out" data-testid="logout">
              <LogOut className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  user, permissions, refData, settings, idleMinutes, children,
}: {
  user: { id: string; name: string; email: string; role: Role };
  permissions: Permission[];
  refData: ReferenceData;
  settings: AppSettings;
  idleMinutes: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [op, setOp] = React.useState<OperationRequest | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [pwOpen, setPwOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const ctx = React.useMemo(
    () => ({
      user,
      permissions,
      can: (p: Permission) => permissions.includes(p),
      ref: refData,
      settings,
      openOperation: (o: OperationRequest) => setOp(o),
      openAddAsset: () => setAddOpen(true),
    }),
    [user, permissions, refData, settings],
  );

  return (
    <AppProvider value={ctx}>
      <TooltipProvider>
        <div className="flex min-h-dvh">
          <aside className={cn("sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 lg:block", collapsed ? "w-[68px]" : "w-60")}>
            <SidebarContent collapsed={collapsed} user={user} permissions={permissions} settings={settings} />
          </aside>
          <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" aria-describedby={undefined}>
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <SidebarContent collapsed={false} user={user} permissions={permissions} settings={settings} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </DialogPrimitive.Root>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-5">
              <button className="rounded-md p-2 text-slate-600 hover:bg-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu className="size-5" />
              </button>
              <button className="hidden rounded-md p-1.5 text-slate-500 hover:bg-muted lg:inline-flex" onClick={toggle} aria-label="Collapse sidebar">
                {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
              </button>
              <GlobalSearch />
              <div className="ml-auto flex items-center gap-1.5">
                <QuickActionsMenu />
                <ThemeToggleButton />
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-muted" data-testid="user-menu">
                      <span className="grid size-8 place-items-center rounded-full bg-[#0f172a] text-[11px] font-semibold text-white dark:bg-sidebar-accent">{initials(user.name)}</span>
                      <span className="hidden text-left leading-tight md:block">
                        <span className="block text-[13px] font-medium">{user.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
                      </span>
                      <ChevronDown className="hidden size-3.5 text-slate-400 md:block" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <DropdownMenuLabel className="normal-case tracking-normal">
                      <div className="text-[13px] font-medium text-foreground">{user.name}</div>
                      <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Appearance</div>
                      <ThemeSwitcher />
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setPwOpen(true)}><KeyRound /> Change password</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => logoutAction()} destructive><LogOut /> Log out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 sm:px-6 sm:py-6">{children}</main>
          </div>
        </div>
        <OperationDialog request={op} onClose={() => setOp(null)} />
        <AssetFormDialog open={addOpen} onOpenChange={setAddOpen} />
        <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
        <IdleWatcher minutes={idleMinutes} />
      </TooltipProvider>
    </AppProvider>
  );
}
