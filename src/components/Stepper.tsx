import { cn } from './cn';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  ariaLabel: string;
  className?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) =>
  Number.isInteger(n) ? String(n) : String(round2(n));

/** Compact −/value/+ numeric stepper. 44px touch targets. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  suffix,
  ariaLabel,
  className,
}: StepperProps) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, round2(v))));
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border bg-surface-2',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => set(value - step)}
        className="grid size-11 place-items-center text-xl text-muted hover:text-text disabled:opacity-30"
        disabled={value <= min}
      >
        −
      </button>
      <span className="tnum min-w-14 text-center text-[15px] font-semibold text-text">
        {fmt(value)}
        {suffix && (
          <span className="ml-0.5 text-[12px] font-normal text-muted">
            {suffix}
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => set(value + step)}
        className="grid size-11 place-items-center text-xl text-muted hover:text-text"
      >
        +
      </button>
    </div>
  );
}
