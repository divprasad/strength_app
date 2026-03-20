import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-[1.45rem] border border-dashed border-border/80 bg-card/68 px-5 py-7 text-center shadow-[inset_0_1px_0_hsl(0_0%_100%/0.45)]">
      <p className="text-base font-semibold tracking-[-0.03em]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
