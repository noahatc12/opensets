/* ============================================================================
   OpenSets — Shared Primitives (React + TypeScript)
   ----------------------------------------------------------------------------
   Every component reads design tokens via var(--token) so it re-themes live
   when data-mode / data-theme / data-ds change on an ancestor. No color is
   hard-coded. Styles are written inline here for a self-contained reference;
   in your codebase, port them to Tailwind utilities (bg-accent, rounded-lg, …)
   or CSS Modules — the token names are identical either way.

   Conventions:
     • num text → fontFamily var(--font-num) + fontVariantNumeric 'tabular-nums'
     • caps labels → fontFamily var(--font-label), textTransform var(--label-tt),
       letterSpacing var(--label-ls)
   ========================================================================== */

import React from 'react';

type Style = React.CSSProperties;

/* ---------------------------------------------------------------- Button --- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  leftIcon?: React.ReactNode;
}

const BTN_SIZES: Record<ButtonSize, Style> = {
  sm: { height: 40, padding: '0 14px', fontSize: 13, borderRadius: 'var(--r-sm)' },
  md: { height: 48, padding: '0 18px', fontSize: 15, borderRadius: 'var(--r-md)' },
  lg: { height: 56, padding: '0 22px', fontSize: 16, borderRadius: 'var(--r-lg)' },
};

const BTN_VARIANTS: Record<ButtonVariant, Style> = {
  primary:   { background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' },
  secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-card)' },
  ghost:     { background: 'transparent', color: 'var(--muted)', border: 'none' },
  danger:    { background: 'color-mix(in oklab, var(--danger) 14%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in oklab, var(--danger) 30%, transparent)' },
};

export function Button({ variant = 'primary', size = 'md', full, leftIcon, children, style, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontWeight: 700, fontFamily: 'var(--font-sans)', cursor: 'pointer',
        width: full ? '100%' : undefined, transition: 'background var(--dur-fast) var(--ease-out)',
        ...BTN_SIZES[size], ...BTN_VARIANTS[variant], ...style,
      }}
    >
      {leftIcon}
      {children}
    </button>
  );
}

/* -------------------------------------------------- Input + NumberStepper --- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numeric?: boolean;
}

export function Input({ numeric, style, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      style={{
        height: 48, padding: '0 14px', width: '100%', boxSizing: 'border-box',
        background: 'var(--surface)', color: 'var(--text)',
        border: '1px solid var(--border-card, var(--border))', borderRadius: 'var(--r-md)',
        fontSize: 15, fontFamily: numeric ? 'var(--font-num)' : 'var(--font-sans)',
        fontVariantNumeric: numeric ? 'tabular-nums' : undefined, outline: 'none',
        ...style,
      }}
    />
  );
}

export interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  unit?: string;
  /** decimals to show (e.g. 1 for 84.0). */
  decimals?: number;
}

/** The session weight/reps control: −  [ value unit ]  + */
export function NumberStepper({ value, onChange, step = 1, min = 0, unit, decimals = 0 }: NumberStepperProps) {
  const btn: Style = {
    width: 48, height: 48, flex: 'none', borderRadius: 'var(--r-md)', border: '1px solid var(--border-strong)',
    background: 'transparent', color: 'var(--text)', fontSize: 22, lineHeight: 1, cursor: 'pointer',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button style={btn} onClick={() => onChange(Math.max(min, value - step))} aria-label="decrease">−</button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <span style={{ fontSize: 'var(--num-md)', fontWeight: 'var(--num-weight)' as any, fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', letterSpacing: 'var(--tracking-snug)' }}>
          {value.toFixed(decimals)}
        </span>
        {unit && <span style={{ fontSize: 15, color: 'var(--muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
      <button style={btn} onClick={() => onChange(value + step)} aria-label="increase">+</button>
    </div>
  );
}

/* ----------------------------------------------------- SegmentedControl --- */

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div style={{ display: 'inline-flex', gap: 5, background: 'var(--surface-2)', padding: 5, borderRadius: 'var(--r-md)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 'var(--r-sm)',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? 'var(--accent-ink)' : 'var(--muted)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Card --- */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  inset?: boolean;
}

export function Card({ elevated, inset, style, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      style={{
        background: elevated ? 'var(--elevated)' : 'var(--surface)',
        border: '1px solid var(--border-card, transparent)',
        borderRadius: 'var(--r-xl)', padding: inset ? 16 : 20,
        boxShadow: elevated ? 'var(--shadow-md)' : 'var(--hairline-top)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- ListRow --- */

export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function ListRow({ leading, title, subtitle, trailing, style, ...rest }: ListRowProps) {
  return (
    <div
      {...rest}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: 'var(--surface)', border: '1px solid var(--border-card, transparent)',
        borderRadius: 'var(--r-md)', cursor: rest.onClick ? 'pointer' : undefined, ...style,
      }}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {trailing}
    </div>
  );
}

/* ------------------------------------------------------------------ Chip --- */

export interface ChipProps {
  selected?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Chip({ selected, children, onClick }: ChipProps) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600,
        padding: '9px 15px', borderRadius: 'var(--r-pill)', cursor: onClick ? 'pointer' : undefined,
        background: selected ? 'var(--accent)' : 'var(--surface)',
        color: selected ? 'var(--accent-ink)' : 'var(--muted)',
        border: selected ? 'none' : '1px solid var(--border-card, var(--border))',
      }}
    >
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- ProgressBar --- */

export interface ProgressBarProps {
  value: number; // 0..1
  height?: number;
  /** override fill (defaults to accent). */
  fill?: string;
}

export function ProgressBar({ value, height = 7, fill = 'var(--accent)' }: ProgressBarProps) {
  return (
    <div style={{ height, borderRadius: 5, background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, value)) * 100}%`, borderRadius: 5, background: fill }} />
    </div>
  );
}

/* --------------------------------------------------------- RestTimerBar --- */

export interface RestTimerBarProps {
  /** seconds remaining. */
  remaining: number;
  /** total rest seconds (for the fill). */
  total: number;
  onAdd: () => void;
  onSub: () => void;
  onSkip: () => void;
}

function fmtClock(t: number): string {
  const m = Math.floor(t / 60), s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RestTimerBar({ remaining, total, onAdd, onSub, onSkip }: RestTimerBarProps) {
  const pct = total > 0 ? remaining / total : 0;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-card, transparent)', borderRadius: 'var(--r-lg)', padding: '14px 16px', boxShadow: 'var(--hairline-top)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-label)', color: 'var(--accent)' }}>Rest</span>
        <span style={{ fontSize: 24, fontWeight: 'var(--num-weight)' as any, fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{fmtClock(remaining)}</span>
      </div>
      <ProgressBar value={pct} height={6} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button size="sm" variant="secondary" onClick={onSub}>−15s</Button>
        <Button size="sm" variant="secondary" onClick={onAdd}>+15s</Button>
        <Button size="sm" variant="ghost" full onClick={onSkip}>Skip</Button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Sheet --- */

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Bottom sheet / modal. Backdrop dims the app; content slides up. Animations
 *  reference --dur-base / --ease-spring (define the keyframes in fonts.css or a
 *  global stylesheet — see os-toast-in below). */
export function Sheet({ open, onClose, children }: SheetProps) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'color-mix(in oklab, var(--bg) 64%, transparent)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: 'var(--elevated)', borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0',
          padding: '10px 20px 30px', boxShadow: 'var(--shadow-lg)', animation: 'os-toast-in var(--dur-base) var(--ease-spring)',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 14px' }} />
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Toast --- */

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 50,
        background: 'var(--elevated)', color: 'var(--text)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-md)', padding: '13px 16px', fontSize: 13.5, fontWeight: 600,
        boxShadow: 'var(--shadow-lg)', animation: 'os-toast-in var(--dur-base) var(--ease-spring)',
      }}
    >
      {message}
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState --- */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      {icon && <div style={{ color: 'var(--faint)', marginBottom: 14 }}>{icon}</div>}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {body && <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{body}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- TabBar --- */

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
}

export interface TabBarProps<T extends string> {
  value: T;
  items: TabItem<T>[];
  onChange: (id: T) => void;
}

export function TabBar<T extends string>({ value, items, onChange }: TabBarProps<T>) {
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30,
        display: 'flex', padding: '8px 12px 26px', gap: 4,
        background: 'color-mix(in oklab, var(--bg) 86%, transparent)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 0',
              color: active ? 'var(--accent)' : 'var(--faint)',
              fontSize: 10.5, fontWeight: 600, fontFamily: 'var(--font-sans)',
            }}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
