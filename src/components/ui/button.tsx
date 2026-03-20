import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
          variant === "default" &&
            "border-primary/15 bg-primary text-primary-foreground shadow-[0_18px_38px_-24px_hsl(var(--primary)/0.8)] hover:bg-primary/92 hover:shadow-[0_20px_42px_-24px_hsl(var(--primary)/0.9)]",
          variant === "secondary" &&
            "border-border/70 bg-accent/82 text-accent-foreground shadow-[0_14px_32px_-26px_hsl(var(--foreground)/0.45)] hover:bg-accent",
          variant === "ghost" && "border-transparent bg-transparent text-foreground shadow-none hover:border-border/70 hover:bg-card",
          variant === "destructive" &&
            "border-destructive/25 bg-destructive text-destructive-foreground shadow-[0_18px_38px_-26px_hsl(var(--destructive)/0.65)] hover:bg-destructive/92",
          size === "default" && "h-11 px-4 py-2",
          size === "sm" && "h-9 px-3 text-sm",
          size === "lg" && "h-12 px-6",
          size === "icon" && "h-10 w-10",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
