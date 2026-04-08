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
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium tracking-[-0.01em] transition-all duration-200 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
          variant === "default" &&
            "border-primary/20 bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--primary)/0.3),_0_8px_24px_-8px_hsl(var(--primary)/0.4)] hover:brightness-110 hover:shadow-[0_1px_2px_hsl(var(--primary)/0.3),_0_12px_32px_-8px_hsl(var(--primary)/0.5)]",
          variant === "secondary" &&
            "border-border/60 bg-accent/80 text-accent-foreground shadow-e1 hover:bg-accent hover:border-border",
          variant === "ghost" && "border-transparent bg-transparent text-foreground shadow-none hover:bg-muted/60",
          variant === "destructive" &&
            "border-destructive/20 bg-destructive text-destructive-foreground shadow-[0_1px_2px_hsl(var(--destructive)/0.3),_0_8px_24px_-8px_hsl(var(--destructive)/0.35)] hover:brightness-110",
          size === "default" && "h-11 px-5 py-2 text-sm",
          size === "sm" && "h-9 px-3.5 text-[13px]",
          size === "lg" && "h-12 px-6 text-base",
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
