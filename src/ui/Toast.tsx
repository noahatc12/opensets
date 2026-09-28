import type { ReactNode } from 'react';

/* Toast: elevated surface, optional action. `bottom` is set by the caller because the
   tab bar, a sheet or the logger's CTA each push it up a different amount. */
export function Toast({ children, bottom, action, onAction }: { children: ReactNode; bottom: number; action?: string; onAction?: () => void }) {
  return (
    <div role="status" className="os-toast" style={{ bottom }}>
      <span className="flex-1">{children}</span>
      {action && onAction && (
        <button type="button" onClick={onAction} className="h-[38px] rounded-[11px] px-3 text-[13px] font-extrabold" style={{ color: 'var(--acc-tx)', background: 'var(--s1)' }}>
          {action}
        </button>
      )}
    </div>
  );
}
