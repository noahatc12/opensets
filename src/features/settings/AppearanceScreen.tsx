import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../state/theme';
import { CURATED_THEMES } from '../../theme';
import { CustomThemePicker } from './CustomThemePicker';

/* Ported faithfully from the Tempo prototype Appearance screen
   (OpenSets.dc.html lines 699-808): Design template cards → Mode segmented →
   Curated-theme cards (dot + name + descriptor) → the always-present custom
   "Build your own" editor + Use-custom-theme CTA. */

const DEFAULT_CUSTOM = { baseColor: '#0E0D0B', accent: '#cda35f' };

/** Curated-theme descriptors, matching the prototype copy. */
const THEME_SUB: Record<string, string> = {
  tempo: 'Warm brass',
  teal: 'Readout signal',
  graphite: 'Monochrome',
  steel: 'Cool blue-grey',
  volt: 'Electric lime',
  ember: 'Warm orange',
  clinic: 'Clinical blue',
  midnight: 'Deep indigo',
  rose: 'Warm rose',
  pine: 'Deep forest green',
};

const SectionLabel = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div
    className="mx-1 mb-2.5 text-[11px] font-bold uppercase text-faint"
    style={{
      letterSpacing: 'var(--tracking-caps)',
      fontFamily: 'var(--font-label)',
      marginTop: first ? 4 : 22,
    }}
  >
    {children}
  </div>
);

export function AppearanceScreen() {
  const navigate = useNavigate();
  const sel = useThemeStore((s) => s.selection);
  const update = useThemeStore((s) => s.update);
  const ds = sel.ds ?? 'tempo';
  const custom = sel.custom ?? DEFAULT_CUSTOM;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate('/settings')}
          className="size-10 bg-transparent text-[22px] text-muted"
          aria-label="Back"
        >
          ‹
        </button>
        <div className="text-[22px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
          Appearance
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-24 pt-1.5">
        {/* design template */}
        <SectionLabel first>Design template</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => update({ ds: 'tempo' })}
            className="rounded-[var(--r-md)] px-4 py-[15px] text-left"
            style={{
              background: 'var(--surface)',
              border: `1.5px solid ${ds === 'tempo' ? 'var(--accent)' : 'var(--border-card)'}`,
            }}
          >
            <div className="text-[15px] font-semibold text-text" style={{ fontFamily: "'Hanken Grotesk Variable','Hanken Grotesk',sans-serif" }}>
              Tempo
            </div>
            <div className="mt-1 text-[11px] leading-[1.35] text-muted">
              Calm premium-data. Soft surfaces, humanist sans.
            </div>
          </button>
          <button
            onClick={() => update({ ds: 'readout' })}
            className="rounded-[var(--r-md)] px-4 py-[15px] text-left"
            style={{
              background: 'var(--surface)',
              border: `1.5px solid ${ds === 'readout' ? 'var(--accent)' : 'var(--border-card)'}`,
            }}
          >
            <div className="text-[15px] font-bold text-text" style={{ fontFamily: "'JetBrains Mono Variable','JetBrains Mono',monospace" }}>
              Readout
            </div>
            <div className="mt-1 text-[11px] leading-[1.35] text-muted">
              Technical instrument. Hairlines, mono numerals.
            </div>
          </button>
        </div>

        {/* mode */}
        <SectionLabel>Mode</SectionLabel>
        <div className="flex gap-1.5 rounded-[var(--r-md)] p-[5px]" style={{ background: 'var(--surface)' }}>
          {(['dark', 'light'] as const).map((m) => {
            const active = sel.mode === m;
            return (
              <button
                key={m}
                onClick={() => update({ mode: m })}
                className="h-11 flex-1 rounded-[var(--r-sm)] text-[14px] font-semibold"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-ink)' : 'var(--muted)',
                }}
              >
                {m === 'dark' ? 'Dark' : 'Light'}
              </button>
            );
          })}
        </div>

        {/* curated themes */}
        <SectionLabel>Curated themes</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {CURATED_THEMES.map((th) => {
            const active = sel.theme === th.id;
            return (
              <button
                key={th.id}
                onClick={() => update({ theme: th.id })}
                className="flex items-center gap-[11px] rounded-[var(--r-md)] px-3.5 py-[13px] text-left"
                style={{
                  background: 'var(--surface)',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border-card)'}`,
                }}
              >
                <span className="size-[26px] flex-none rounded-full" style={{ background: th.swatch }} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-text">{th.label}</span>
                  <span className="block truncate text-[10.5px] text-muted">{THEME_SUB[th.id]}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* custom theme — always present, like the prototype */}
        <SectionLabel>Custom theme</SectionLabel>
        <CustomThemePicker
          value={custom}
          onChange={(next) => update({ theme: 'custom', custom: next })}
        />
        <button
          onClick={() => update({ theme: 'custom', custom })}
          className="mt-4 h-12 w-full rounded-[var(--r-md)] text-[14px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Use custom theme
        </button>

        <p className="mt-[22px] text-center text-[11px] leading-[1.5] text-faint">
          Educational tool — not medical advice.
          <br />
          Your data never leaves your device.
        </p>
      </div>
    </div>
  );
}
