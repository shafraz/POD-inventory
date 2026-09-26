import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, wrapperClassName, ...props }: React.HTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative w-full overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full caption-bottom text-[13px]", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-slate-50/80 [&_tr]:border-b", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-slate-50/70 data-[state=selected]:bg-blue-50/60", className)} {...props} />;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-9 whitespace-nowrap px-3 text-left align-middle text-[11.5px] font-semibold uppercase tracking-wide text-slate-500", className)} {...props} />;
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
