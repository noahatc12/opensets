import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  leadingIcon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover active:brightness-95 font-bold',
  secondary:
    'bg-surface-2 text-text border border-border hover:border-border-strong font-semibold',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-surface-2',
  danger:
    'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
};

/** Primary action control. ≥48px tall (touch target / quality floor). */
export function Button({
  variant = 'primary',
  block = false,
  leadingIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 text-[15px]',
        'transition-colors duration-150 ease-[var(--ease-out)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
