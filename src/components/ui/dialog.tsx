"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  onInteractOutside,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in print:hidden" />
      <DialogPrimitive.Content
        onInteractOutside={onInteractOutside}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-4 shadow-xl shadow-denim-950/10 ring-1 ring-slate-900/5 focus:outline-none sm:w-[calc(100%-2rem)] sm:p-6",
          // Print override: the dialog is normally `fixed` + centered via
          // `transform: translate(-50%,-50%)` + capped at `max-h-[92vh]`
          // with `overflow-y-auto`. None of that plays nicely with the print
          // page box — `fixed`+`translate` gets mispositioned against the
          // print viewport (often landing mostly off-page, so only a sliver
          // near the top prints), and `max-h-[92vh] overflow-y-auto` clips
          // anything that needed scrolling in the modal (which is exactly
          // where the barcode/label content lives). This is why printed
          // barcode labels/cards were coming out cut off or missing the
          // barcode entirely. Reset it all to normal static flow for print
          // and let the `#print-area` rule in globals.css (position:
          // absolute; inset: 0) take over the whole page instead.
          "print:static print:left-auto print:top-auto print:z-auto print:max-h-none print:w-auto print:max-w-none print:translate-x-0 print:translate-y-0 print:overflow-visible print:rounded-none print:p-0 print:shadow-none print:ring-0",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm bg-white/80 p-1 opacity-70 hover:opacity-100 focus:outline-none sm:right-4 sm:top-4 sm:bg-transparent print:hidden">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-display text-lg font-semibold text-slate-900", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />;
}
