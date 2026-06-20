import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSettings, updateSettings } from '../../db/hooks';
import { useThemeStore } from '../../state/theme';
import {
  downloadEnvelope,
  importFromJson,
  ImportError,
} from '../../db/exportImport';
import { ChevronRightIcon, ChevronLeftIcon, ShieldIcon } from '../../components/icons';
import { fmtWeight } from '../../lib/units';
import { usePersistentStorage } from './usePersistentStorage';
import { t } from '../../i18n/strings';

/* Ported from the Tempo prototype Settings screen: grouped list rows
   (Units / Training / Storage / App) + privacy card + footer. */

const nowIso = () => new Date().toISOString();
const numFont = { fontFamily: 'var(--font-num)' as const };

/** Compact byte formatter for storage usage/quota. */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[var(--r-md)] border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  onClick,
  last,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  last?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      style={last ? undefined : { borderBottom: '1px solid var(--border)' }}
    >
      <span className="flex-1 text-[14px] font-medium text-text">{label}</span>
      {value}
      {onClick && <ChevronRightIcon className="size-[18px] text-faint" />}
    </button>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    className="mx-1 mb-2 mt-[22px] text-[11px] font-bold uppercase text-faint"
    style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
  >
    {children}
  </div>
);

export function SettingsScreen() {
  const navigate = useNavigate();
  const settings = useSettings();
  const goalCount = useLiveQuery(() => db.goals.count());
  const sel = useThemeStore((s) => s.selection);
  const storage = usePersistentStorage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  /** Wipe the local database + stored preferences, then reload as a fresh install. */
  async function resetAll() {
    try {
      await db.delete();
    } catch {
      /* ignore */
    }
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.href = import.meta.env.BASE_URL;
  }

  async function handleImport(file: File) {
    try {
      await importFromJson(await file.text());
      setFeedback('Backup restored.');
    } catch (err) {
      setFeedback(err instanceof ImportError ? err.message : 'Could not read file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const themeLabel = `${sel.theme[0]!.toUpperCase()}${sel.theme.slice(1)} · ${sel.mode === 'dark' ? 'Dark' : 'Light'}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate('/today')} className="grid size-10 place-items-center bg-transparent text-muted" aria-label="Back">
          <ChevronLeftIcon className="size-[22px]" />
        </button>
        <div className="text-[22px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
          Settings
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-8 pt-1.5">
        <SectionLabel>Units</SectionLabel>
        <div
          className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        >
          <span className="text-[14px] font-semibold text-text">Weight unit</span>
          <div className="flex gap-1 rounded-[var(--r-sm)] p-1" style={{ background: 'var(--bg)' }}>
            {(['kg', 'lb'] as const).map((u) => {
              const active = settings.units === u;
              return (
                <button
                  key={u}
                  onClick={() => void updateSettings({ units: u })}
                  className="rounded-[7px] px-3.5 py-1.5 text-[13px]"
                  style={{
                    ...numFont,
                    fontWeight: active ? 700 : 600,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-ink)' : 'var(--muted)',
                  }}
                >
                  {u}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mx-1 mt-2 text-[11px] leading-snug text-faint">
          kg is canonical. lb is converted for display only — e.g. 84 kg = 185 lb.
        </p>

        <SectionLabel>Training</SectionLabel>
        <Group>
          <Row
            label="Plate inventory"
            value={
              <span className="flex gap-1">
                {[...settings.plateInventoryKg]
                  .sort((a, b) => b - a)
                  .slice(0, 2)
                  .map((p) => (
                    <span
                      key={p}
                      className="rounded-[var(--r-pill)] bg-bg px-[7px] py-[3px] text-[10px] text-muted"
                      style={numFont}
                    >
                      {fmtWeight(p, settings.units)}
                    </span>
                  ))}
                {settings.plateInventoryKg.length > 2 && (
                  <span className="rounded-[var(--r-pill)] bg-bg px-[7px] py-[3px] text-[10px] text-muted" style={numFont}>
                    +{settings.plateInventoryKg.length - 2}
                  </span>
                )}
              </span>
            }
            onClick={() => navigate('/plates')}
          />
          <Row
            label="Default rest"
            value={
              <span className="text-[13px] text-muted" style={numFont}>
                {Math.floor(settings.defaultRestWorkSec / 60)}:
                {String(settings.defaultRestWorkSec % 60).padStart(2, '0')}
              </span>
            }
            onClick={() => navigate('/rest-defaults')}
          />
          <Row
            label="Goals"
            value={
              <span className="text-[13px] text-muted">
                {goalCount ?? 0} active
              </span>
            }
            onClick={() => navigate('/goals')}
          />
          <Row label="Body measurements" onClick={() => navigate('/measurements')} last />
        </Group>

        <SectionLabel>App</SectionLabel>
        <Group>
          <Row
            label="Appearance"
            value={<span className="text-[13px] text-muted">{themeLabel}</span>}
            onClick={() => navigate('/appearance')}
          />
          <Row label="Backup & export" onClick={() => void downloadEnvelope(nowIso())} />
          <Row label="Import data" onClick={() => fileRef.current?.click()} last />
        </Group>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
          }}
        />

        {feedback && (
          <p role="status" className="mt-3 text-center text-[12px] text-muted">
            {feedback}
          </p>
        )}

        {storage.supported && (
          <>
            <SectionLabel>Storage</SectionLabel>
            <div
              className="overflow-hidden rounded-[var(--r-md)] border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
            >
              <div
                className="px-4 py-3.5"
                style={!storage.persisted ? { borderBottom: '1px solid var(--border)' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-text">On-device storage</span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: storage.persisted ? 'var(--success)' : 'var(--muted)' }}
                  >
                    {storage.persisted ? 'Persistent' : 'Best-effort'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-muted">
                  {storage.persisted ? t.settings.storagePersisted : t.settings.storageBestEffort}
                </p>
                {storage.usageBytes !== null && (
                  <p className="mt-1.5 text-[11px] text-faint" style={numFont}>
                    {t.settings.usage} {fmtBytes(storage.usageBytes)}
                    {storage.quotaBytes ? ` of ${fmtBytes(storage.quotaBytes)}` : ''}
                  </p>
                )}
              </div>
              {!storage.persisted && (
                <button
                  onClick={() => void storage.request()}
                  className="flex w-full items-center px-4 py-3.5 text-left text-[14px] font-medium text-accent"
                >
                  {t.settings.requestPersist}
                </button>
              )}
            </div>
          </>
        )}

        <SectionLabel>Data</SectionLabel>
        <div
          className="overflow-hidden rounded-[var(--r-md)] border"
          style={{
            background: 'var(--surface)',
            borderColor: confirmReset
              ? 'color-mix(in oklab, var(--danger) 45%, var(--border-card))'
              : 'var(--border-card)',
          }}
        >
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <span className="flex-1 text-[14px] font-medium text-danger">Reset all data</span>
              <ChevronRightIcon className="size-[18px] text-faint" />
            </button>
          ) : (
            <div className="px-4 py-3.5">
              <p className="text-[13px] leading-snug text-text">
                Permanently erase all workouts, programs, history, goals, and settings on
                this device. This can't be undone.
              </p>
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="h-11 flex-1 rounded-[var(--r-sm)] text-[13px] font-semibold text-text"
                  style={{ background: 'var(--surface-2)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void resetAll()}
                  className="h-11 flex-1 rounded-[var(--r-sm)] text-[13px] font-bold"
                  style={{ background: 'var(--danger)', color: '#fff' }}
                >
                  Erase everything
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="mx-1 mt-2 text-[11px] leading-snug text-faint">
          Restores the default appearance and clears onboarding — the app reloads like a
          fresh install.
        </p>

        <div
          className="mt-[22px] rounded-[var(--r-md)] border p-4"
          style={{
            background: 'color-mix(in oklab, var(--accent) 7%, var(--surface))',
            borderColor: 'color-mix(in oklab, var(--accent) 16%, transparent)',
          }}
        >
          <div className="flex items-center gap-2">
            <ShieldIcon className="size-4 text-accent" />
            <span className="text-[13px] font-bold text-accent">Private by default</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-muted">
            Your data never leaves your device. No account, no sync, no tracking.
          </p>
        </div>
        <p className="mt-[18px] text-center text-[11px] leading-snug text-faint">
          Educational tool — not medical advice.
          <br />
          v1.0 · MIT · free-exercise-db
        </p>
      </div>
    </div>
  );
}
