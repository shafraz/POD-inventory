"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

// ── Dialog ────────────────────────────────────────────────────

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: "sm" | "md" | "lg" | "xl" }) {
  const width = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          width,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3.5 top-3.5 rounded-md p-1 text-slate-400 transition hover:bg-muted hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 border-b px-5 pb-3.5 pt-4 pr-12", className)} {...props} />;
}
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-2 border-t bg-slate-50/60 px-5 py-3 sm:flex-row sm:justify-end rounded-b-xl", className)} {...props} />;
}
export const DialogTitle = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn("text-base font-semibold tracking-tight text-slate-900", className)} {...props} />
);
export const DialogDescription = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description className={cn("text-[13px] text-muted-foreground", className)} {...props} />
);

// ── Sheet (mobile drawer) ─────────────────────────────────────

export function SheetContent({ className, children, side = "left", ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-72 max-w-[85vw] flex-col shadow-2xl data-[state=open]:animate-in data-[state=open]:duration-200",
          side === "left" ? "left-0 data-[state=open]:slide-in-from-left" : "right-0 data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// ── Alert dialog (confirmations) ─────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-slate-950/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <AlertDialogPrimitive.Title className="text-base font-semibold text-slate-900">{title}</AlertDialogPrimitive.Title>
          {description && <AlertDialogPrimitive.Description className="mt-2 text-sm text-slate-600">{description}</AlertDialogPrimitive.Description>}
          {children}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel className={buttonVariants({ variant: "outline" })} disabled={loading}>
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <button
              type="button"
              className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
              disabled={loading}
              onClick={onConfirm}
              data-testid="confirm-button"
            >
              {loading ? "Working…" : confirmLabel}
            </button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

// ── Dropdown menu ────────────────────────────────────────────

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;

export function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 min-w-[11rem] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-slate-500",
        destructive && "text-red-600 focus:bg-red-50 [&_svg]:text-red-500",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>) {
  return (
    <DropdownPrimitive.CheckboxItem
      className={cn("relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-2 text-[13px] outline-none focus:bg-muted", className)}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center rounded-[3px] border border-slate-300">
        <DropdownPrimitive.ItemIndicator>
          <span className="block size-2 rounded-[2px] bg-primary" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return <DropdownPrimitive.Label className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
