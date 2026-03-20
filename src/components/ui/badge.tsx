import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-[0.72rem] font-medium text-muted-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4)]",
        className
      )}
      {...props}
    />
  );
}
