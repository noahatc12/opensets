import { useId } from 'react';

export interface TrendPoint {
  date: string;
  value: number;
  isPR?: boolean;
}

/* The e1RM trend: an area under the accent line, record dots in the record colour, the
   latest point ringed in accent. Straight segments; the data is sparse and honest. */
export function TrendChart({
  points,
  height = 120,
}: {
  points: TrendPoint[];
  height?: number;
}) {
  const gid = useId();
  const w = 320;
  const h = height;
  const pad = 6;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - 2 * pad);
    const y = 12 + (1 - (p.value - min) / span) * (h - 32);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${pts[pts.length - 1]![0].toFixed(1)} ${h} L${pts[0]![0].toFixed(1)} ${h} Z`;
  const lastIdx = pts.length - 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{
        width: '100%',
        height: 'auto',
        overflow: 'visible',
        display: 'block',
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--acc)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--acc)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--acc)"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map(([x, y], i) =>
        points[i]!.isPR && i !== lastIdx ? (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="5"
            fill="var(--pr)"
            stroke="var(--s1)"
            strokeWidth="2"
          />
        ) : null,
      )}
      <circle
        cx={pts[lastIdx]![0]}
        cy={pts[lastIdx]![1]}
        r="6"
        fill={points[lastIdx]!.isPR ? 'var(--pr)' : 'var(--ink)'}
        stroke="var(--acc)"
        strokeWidth="3"
      />
    </svg>
  );
}
