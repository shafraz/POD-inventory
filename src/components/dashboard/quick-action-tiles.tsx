"use client";

import { useQuickActions } from "@/components/app/quick-actions";
import { cn } from "@/lib/utils";

export function QuickActionTiles() {
  const actions = useQuickActions();
  if (!actions.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-testid="quick-action-tiles">
      {actions.map((a) => (
        <button
          key={a.kind}
          onClick={a.run}
          className="flex shrink-0 items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:shadow-sm"
          data-testid={`qa-${a.kind}`}
        >
          <span className={cn("grid size-7 place-items-center rounded-md", a.tone)}><a.icon className="size-3.5" /></span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
