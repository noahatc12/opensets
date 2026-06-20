import { cn } from './cn';

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Compact segmented control (e.g. kg / lb). Keyboard + screen-reader friendly. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex w-full rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-h-9 flex-1 rounded-[7px] px-3.5 text-[14px] font-medium transition-colors',
              active
                ? 'bg-accent text-accent-ink'
                : 'text-muted hover:text-text',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
