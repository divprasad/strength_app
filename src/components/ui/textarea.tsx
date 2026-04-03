import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-xl border border-border/60 bg-card/72 px-3.5 py-3 text-sm shadow-[inset_0_1px_0_hsl(0_0%_100%/0.55)] transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/12",
        className
      )}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";
