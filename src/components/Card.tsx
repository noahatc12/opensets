import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Layered surface container. */
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardRowProps {
  label: ReactNode;
  value?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}

/** A labeled row inside a settings card: label + optional hint on the left,
 *  value/control on the right. */
export function CardRow({ label, value, hint, children }: CardRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-text">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[13px] leading-snug text-muted">
            {hint}
          </div>
        )}
      </div>
      <div className="shrink-0">{value ?? children}</div>
    </div>
  );
}
