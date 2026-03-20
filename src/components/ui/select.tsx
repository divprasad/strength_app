import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[1rem] border border-border/75 bg-card/72 px-3.5 py-2 text-sm shadow-[inset_0_1px_0_hsl(0_0%_100%/0.55)] transition-[border-color,background-color,box-shadow] duration-200 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12",
        className
      )}
      {...props}
    />
  )
);

Select.displayName = "Select";
