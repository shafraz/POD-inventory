"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, AlertTriangle, AlertOctagon, Info, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { markNotificationsReadAction } from "@/app/actions/admin";
import { cn, formatDateTime } from "@/lib/utils";
import { usePathname } from "next/navigation";

type Item = { id: string; type: string; severity: string; title: string; message: string; link: string | null; createdAt: string; read: boolean };

const ICONS: Record<string, { icon: React.ElementType; cls: string }> = {
  critical: { icon: AlertOctagon, cls: "text-red-600 bg-red-50" },
  warning: { icon: AlertTriangle, cls: "text-amber-600 bg-amber-50" },
  success: { icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50" },
  info: { icon: Info, cls: "text-blue-600 bg-blue-50" },
};

export function NotificationBell() {
  const [data, setData] = React.useState<{ items: Item[]; unread: number }>({ items: [], unread: 0 });
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load, pathname]);

  const markAll = async () => {
    await markNotificationsReadAction("all");
    load();
  };
  const markOne = async (id: string) => {
    await markNotificationsReadAction([id]);
    setOpen(false);
    load();
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 text-slate-600 hover:bg-muted" aria-label={`Notifications (${data.unread} unread)`} data-testid="notification-bell">
          <Bell className="size-[18px]" />
          {data.unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
              {data.unread > 99 ? "99+" : data.unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="text-sm font-semibold">Notifications</div>
          {data.unread > 0 && (
            <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {data.items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">You’re all caught up.</div>
          ) : (
            data.items.map((n) => {
              const I = ICONS[n.severity] ?? ICONS.info;
              const body = (
                <div className={cn("flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-slate-50", !n.read && "bg-blue-50/40")}>
                  <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", I.cls)}><I.icon className="size-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-medium leading-snug text-slate-900">{n.title}</div>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" />}
                    </div>
                    <div className="mt-0.5 text-[12.5px] leading-snug text-slate-600">{n.message}</div>
                    <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</div>
                  </div>
                </div>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => markOne(n.id)} className="block">{body}</Link>
              ) : (
                <button key={n.id} onClick={() => markOne(n.id)} className="block w-full text-left">{body}</button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
