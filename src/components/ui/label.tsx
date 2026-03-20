import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground", className)}
      {...props}
    />
  );
}
