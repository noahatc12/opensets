import type { ReactNode } from 'react';

/* Toast: elevated surface, optional action. With `bottom` it floats that far above the
   container's bottom edge. Without it, it sits in the layout flow, so the controls it would
   have floated over stay reachable (the logger renders it above its CTA or rest panel). */
export function Toast({
  children,
  bottom,
  action,
  onAction,
}: {
  children: ReactNode;
  bottom?: number;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="status"
      className="os-toast"
      style={
        bottom === undefined
          ? { position: 'relative', left: 'auto', right: 'auto' }
          : { bottom }
      }
    >
      <span className="flex-1">{children}</span>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-[38px] rounded-[11px] px-3 text-[13px] font-extrabold"
          style={{ color: 'var(--acc-tx)', background: 'var(--s1)' }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
