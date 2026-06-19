import type { ReactNode } from 'react';

interface ScreenProps {
  title: string;
  children: ReactNode;
}

/** Standard screen layout: a sticky blurred header with the screen title, then a
 *  padded content column. Top padding respects the device safe area (notch). */
export function Screen({ title, children }: ScreenProps) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-bg/85 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="text-[26px] font-bold tracking-tight text-text">
          {title}
        </h1>
      </header>
      <div className="px-5 pb-8 pt-5">{children}</div>
    </div>
  );
}

interface SectionProps {
  title?: string;
  children: ReactNode;
}

/** A titled group within a screen. */
export function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-7">
      {title && (
        <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-faint">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
