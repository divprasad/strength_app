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
        "relative overflow-hidden rounded-[1.9rem] border border-white/50 bg-card/88 px-5 py-5 shadow-[0_24px_70px_-42px_hsl(var(--foreground)/0.48)] ring-1 ring-black/5 md:px-7 md:py-6",
        className
      )}
    >
      <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.45),transparent_65%)] md:block" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          {eyebrow ? (
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-primary/70">{eyebrow}</p>
          ) : null}
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-[-0.05em] md:text-[2.5rem]">{title}</h1>
            {description ? <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
          </div>
          {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
    </section>
  );
}
