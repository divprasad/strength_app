import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "accent";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-muted/70 text-muted-foreground border-border/70",
    secondary: "bg-secondary text-secondary-foreground border-transparent",
    outline: "border-border/60 text-foreground bg-transparent",
    accent: "bg-accent text-accent-foreground border-transparent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-medium shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4)]",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
