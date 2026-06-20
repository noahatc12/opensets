import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { useThemeStore } from '../../state/theme';
import { CURATED_THEMES } from '../../theme';
import { cn } from '../../components/cn';

export function AppearanceScreen() {
  const navigate = useNavigate();
  const sel = useThemeStore((s) => s.selection);
  const update = useThemeStore((s) => s.update);

  return (
    <div className="h-full overflow-auto">
      <button
        onClick={() => navigate('/settings')}
        className="ml-3 mt-[max(0.75rem,env(safe-area-inset-top))] px-2 text-[15px] text-muted"
      >
        ‹ Settings
      </button>
      <Screen title="Appearance">
        <Section title="Mode">
          <Segmented
            ariaLabel="Mode"
            value={sel.mode}
            onChange={(mode) => update({ mode })}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </Section>

        <Section title="Design template">
          <Segmented
            ariaLabel="Design template"
            value={sel.ds ?? 'tempo'}
            onChange={(ds) => update({ ds })}
            options={[
              { value: 'tempo', label: 'Tempo' },
              { value: 'readout', label: 'Readout' },
            ]}
          />
          <p className="mt-2 px-1 text-[12px] leading-snug text-muted">
            Tempo is calm and premium; Readout is technical and high-contrast.
          </p>
        </Section>

        <Section title="Theme">
          <div className="grid grid-cols-4 gap-3">
            {CURATED_THEMES.map((th) => {
              const active = sel.theme === th.id;
              return (
                <button
                  key={th.id}
                  onClick={() => update({ theme: th.id })}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      'grid size-14 place-items-center rounded-[var(--r-lg)] border-2',
                    )}
                    style={{
                      background: 'var(--surface)',
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    <span
                      className="size-7 rounded-full"
                      style={{ background: th.swatch }}
                    />
                  </span>
                  <span
                    className={cn(
                      'text-[11px]',
                      active ? 'font-semibold text-text' : 'text-muted',
                    )}
                  >
                    {th.label}
                  </span>
                </button>
              );
            })}

            {/* Custom */}
            <button
              onClick={() =>
                update({
                  theme: 'custom',
                  custom: sel.custom ?? { baseColor: '#0E0D0B', accent: '#cda35f' },
                })
              }
              className="flex flex-col items-center gap-1.5"
            >
              <span
                className="grid size-14 place-items-center rounded-[var(--r-lg)] border-2"
                style={{
                  background: 'var(--surface)',
                  borderColor: sel.theme === 'custom' ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <span
                  className="size-7 rounded-full"
                  style={{
                    background:
                      'conic-gradient(from 0deg,#e0735c,#e0a85c,#6fbf8e,#6fa0d6,#8d8ef2,#e06a86,#e0735c)',
                  }}
                />
              </span>
              <span
                className={cn(
                  'text-[11px]',
                  sel.theme === 'custom' ? 'font-semibold text-text' : 'text-muted',
                )}
              >
                Custom
              </span>
            </button>
          </div>

          {sel.theme === 'custom' && (
            <div className="mt-4 flex flex-col gap-3 rounded-[var(--r-lg)] bg-surface p-4">
              <ColorField
                label="Accent"
                value={sel.custom?.accent ?? '#cda35f'}
                onChange={(accent) =>
                  update({
                    theme: 'custom',
                    custom: {
                      baseColor: sel.custom?.baseColor ?? '#0E0D0B',
                      accent,
                    },
                  })
                }
              />
              <ColorField
                label="Base"
                value={sel.custom?.baseColor ?? '#0E0D0B'}
                onChange={(baseColor) =>
                  update({
                    theme: 'custom',
                    custom: {
                      baseColor,
                      accent: sel.custom?.accent ?? '#cda35f',
                    },
                  })
                }
              />
              <p className="text-[12px] leading-snug text-muted">
                Surfaces, borders, and text are derived from your base + accent so it
                always reads as one palette.
              </p>
            </div>
          )}
        </Section>
      </Screen>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-[14px] font-medium text-text">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[12px] text-muted" style={{ fontFamily: 'var(--font-num)' }}>
          {value.toUpperCase()}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded-[var(--r-sm)] border border-border bg-transparent"
          aria-label={label}
        />
      </span>
    </label>
  );
}
