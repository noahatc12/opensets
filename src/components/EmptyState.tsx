import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

/** Designed empty state — every list/screen ships one (spec §10). */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      {icon && (
        <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-border bg-surface text-accent">
          <span className="[&>svg]:size-8">{icon}</span>
        </div>
      )}
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-muted">
        {body}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
