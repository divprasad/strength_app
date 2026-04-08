import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageIntro({ eyebrow, title, description, action, meta, className }: PageIntroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/30 bg-card/80 px-5 py-5 shadow-e2 backdrop-blur-lg md:px-7 md:py-6 animate-fade-up",
        className
      )}
    >
      <div className="absolute inset-y-0 right-0 hidden w-64 bg-[radial-gradient(circle_at_top_right,hsl(var(--glow)/0.12),transparent_70%)] md:block" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2.5">
          {eyebrow ? (
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary/70">{eyebrow}</p>
          ) : null}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-[-0.04em] md:text-[2.25rem] md:leading-tight">{title}</h1>
            {description ? <p className="max-w-3xl text-sm text-muted-foreground/80 md:text-base">{description}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
    </section>
  );
}
