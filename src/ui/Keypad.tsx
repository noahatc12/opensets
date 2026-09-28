import { useState } from 'react';
import { Sheet } from './Sheet';

/* Tap-to-type numeric keypad. The display shows the current value faint until the first
   key, then the buffer in ink. */
export function KeypadSheet({
  open,
  label,
  current,
  decimal,
  onDone,
  onClose,
}: {
  open: boolean;
  label: string;
  current: string;
  decimal: boolean;
  onDone: (value: number) => void;
  onClose: () => void;
}) {
  const [buf, setBuf] = useState('');
  const close = () => {
    setBuf('');
    onClose();
  };
  const press = (k: string) => {
    setBuf((b) => {
      if (k === 'del') return b.slice(0, -1);
      if (k === '.') return b.includes('.') ? b : (b || '0') + '.';
      if (b.replace('.', '').length >= 5) return b;
      return b === '0' ? k : b + k;
    });
  };
  const done = () => {
    const v = parseFloat(buf);
    if (!Number.isNaN(v)) onDone(v);
    close();
  };
  const keys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    decimal ? '.' : '',
    '0',
    'del',
  ];
  return (
    <Sheet open={open} onClose={close} label={label}>
      <div className="flex items-center justify-between">
        <span className="os-t">{label}</span>
        <button
          type="button"
          onClick={close}
          className="h-10 px-2 text-[14px] font-bold"
          style={{ color: 'var(--acc-tx)' }}
        >
          Cancel
        </button>
      </div>
      <div
        className="os-num text-center"
        aria-live="polite"
        style={{
          fontSize: 88,
          padding: '10px 0 16px',
          color: buf ? 'var(--ink)' : 'var(--faint)',
        }}
      >
        {buf || current}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k, i) => (
          <button
            key={i}
            type="button"
            onClick={() => k && press(k)}
            aria-label={k === 'del' ? 'Delete' : k || undefined}
            tabIndex={k ? 0 : -1}
            className="os-press h-14 rounded-[14px] text-[24px] font-bold"
            style={{
              background: 'var(--s2)',
              boxShadow: 'inset 0 1px 0 var(--hl2)',
              opacity: k ? 1 : 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {k === 'del' ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto"
              >
                <path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z" />
                <path d="M13 10l4 4M17 10l-4 4" />
              </svg>
            ) : (
              k
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={done}
        className="os-btn os-btn--pri os-press mt-3"
      >
        Set
      </button>
    </Sheet>
  );
}
