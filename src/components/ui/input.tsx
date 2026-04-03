import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border/60 bg-card/72 px-3.5 py-2 text-sm shadow-[inset_0_1px_0_hsl(0_0%_100%/0.55)] transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
