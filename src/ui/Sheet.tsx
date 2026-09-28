import { useEffect, type ReactNode } from 'react';

/* Bottom sheet: scrim that closes on tap, panel that rises on the out-ease, a grabber,
   Escape closes. Positioned inside the app shell (position: relative) so it respects the
   phone's safe areas the same way the tab bar does. */
export function Sheet({
  open,
  onClose,
  children,
  label,
  height,
  role = 'dialog',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  height?: string;
  role?: 'dialog' | 'alertdialog';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div className="os-scrim" onClick={onClose} aria-hidden />
      <div
        role={role}
        aria-modal="true"
        aria-label={label}
        className="os-sheet"
        style={height ? { height } : undefined}
      >
        <div className="os-grab" />
        {children}
      </div>
    </div>
  );
}

/** Sheet header: bold title left, a text action right. */
export function SheetHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-none items-center justify-between">
      <span
        className="text-[22px] font-extrabold"
        style={{ letterSpacing: '-.03em' }}
      >
        {title}
      </span>
      <button
        type="button"
        onClick={onAction}
        className="h-10 px-2 text-[14px] font-bold"
        style={{ color: 'var(--acc-tx)' }}
      >
        {action}
      </button>
    </div>
  );
}

/** Destructive confirm sheet. */
export function ConfirmSheet({
  open,
  title,
  body,
  cta,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  cta: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title} role="alertdialog">
      <div
        className="text-[24px] font-extrabold leading-tight"
        style={{ letterSpacing: '-.03em' }}
      >
        {title}
      </div>
      <p
        className="mb-[18px] mt-2 text-[15px] leading-[1.45]"
        style={{ color: 'var(--mute)' }}
      >
        {body}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="os-btn os-press"
        style={{
          background: 'var(--danger)',
          color: '#fff',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
        }}
      >
        {cta}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="os-btn os-btn--sm os-press mt-2"
      >
        Cancel
      </button>
    </Sheet>
  );
}
