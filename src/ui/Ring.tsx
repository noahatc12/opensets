import type { ReactNode } from 'react';

/* A progress ring. `value` is 0..1 of the arc filled, drawn from twelve o'clock. */
export function Ring({
  size,
  stroke,
  value,
  color = 'var(--acc)',
  track = 'var(--s3)',
  animate = false,
  children,
  label,
}: {
  size: number;
  stroke: number;
  value: number;
  color?: string;
  track?: string;
  /** Ease the arc between values (the rest timer drains one second at a time). */
  animate?: boolean;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="os-ring"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={animate ? 'os-ring-arc' : undefined}
        />
      </svg>
      {children !== undefined && <div className="os-ring-in">{children}</div>}
    </div>
  );
}
