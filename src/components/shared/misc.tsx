import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACTION_COLORS, ACTION_LABELS, VERIFICATION_STATE_COLORS, VERIFICATION_STATE_LABELS, type VerificationState } from "@/lib/constants";
import type { MovementAction } from "@prisma/client";

export function PageHeader({ title, description, actions, breadcrumb }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; breadcrumb?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1.5 text-xs text-muted-foreground">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ name, color }: { name: string; color: string }) {
  return <Badge color={color} dot>{name}</Badge>;
}

export function VerificationBadge({ state }: { state: VerificationState }) {
  return <Badge color={VERIFICATION_STATE_COLORS[state]}>{VERIFICATION_STATE_LABELS[state]}</Badge>;
}

export function ActionBadge({ action }: { action: MovementAction }) {
  return <Badge color={ACTION_COLORS[action]}>{ACTION_LABELS[action]}</Badge>;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: { icon?: React.ElementType; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400"><Icon className="size-5" /></div>
      <div className="mt-3 text-sm font-medium text-slate-900">{title}</div>
      {description && <div className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-8 items-center gap-1 rounded-md border bg-card px-2.5 text-[12.5px] font-medium hover:bg-muted";
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 text-[12.5px] text-muted-foreground sm:flex-row">
      <div>
        Showing <span className="font-medium text-foreground">{from}–{to}</span> of <span className="font-medium text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {page > 1 ? <Link className={btn} href={hrefFor(page - 1)}><ChevronLeft className="size-3.5" /> Prev</Link> : <span className={cn(btn, "pointer-events-none opacity-40")}><ChevronLeft className="size-3.5" /> Prev</span>}
        <span className="px-2">Page {page} / {pages}</span>
        {page < pages ? <Link className={btn} href={hrefFor(page + 1)}>Next <ChevronRight className="size-3.5" /></Link> : <span className={cn(btn, "pointer-events-none opacity-40")}>Next <ChevronRight className="size-3.5" /></span>}
      </div>
    </div>
  );
}

export function InfoList({ items, className }: { items: { label: string; value: React.ReactNode; mono?: boolean }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[11.5px] font-medium uppercase tracking-wide text-slate-400">{i.label}</dt>
          <dd className={cn("mt-0.5 break-words text-[13.5px] text-slate-900", i.mono && "font-mono text-[13px]")}>{i.value === null || i.value === undefined || i.value === "" ? <span className="text-slate-300">—</span> : i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
