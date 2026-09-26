import * as React from "react";
import { cn } from "@/lib/utils";

/** Label + control + hint/error, used by every form. */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
  htmlFor,
}: {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[12.5px] font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {child}
      {error ? <p className="text-xs text-red-600">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}
