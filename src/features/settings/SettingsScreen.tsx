import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSettings, updateSettings, useProfile } from '../../db/hooks';
import { useThemeStore } from '../../state/theme';
import { inToFtIn, fmtWeight, toUnit } from '../../lib/units';
import { clock, compact, monthDay } from '../../lib/format';
import { ageFromBirthDate } from '../../lib/age';
import {
  downloadEnvelope,
  importFromJson,
  ImportError,
} from '../../db/exportImport';
import { seedSampleData } from '../../db/sampleData';
import { useCatalog } from '../library/useCatalog';
import { usePersistentStorage } from './usePersistentStorage';
import { t } from '../../i18n/strings';
import { ScreenTitle, SectionHead, StatTiles } from '../../ui/StatGrid';
import { ConfirmSheet } from '../../ui/Sheet';
import { PlateMarks } from '../../ui/Plates';

/* You: settings and data. Three tiles, Units and Appearance segments, then Training,
   Body and Your data as cards of rows, the storage status, the privacy card. */

const nowIso = () => new Date().toISOString();

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function Row({
  label,
  sub,
  value,
  onClick,
  danger,
}: {
  label: string;
  sub?: string;
  value?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[15px] font-semibold"
          style={danger ? { color: 'var(--danger)' } : undefined}
        >
          {label}
        </span>
        {sub && (
          <span
            className="mt-0.5 block truncate text-[12px] font-medium"
            style={{ color: 'var(--mute)' }}
          >
            {sub}
          </span>
        )}
      </span>
      {value}
      {onClick && !danger && <span className="os-chev" />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="os-row os-press">
      {inner}
    </button>
  ) : (
    <div className="os-row">{inner}</div>
  );
}

const Value = ({
  children,
  unit,
}: {
  children: React.ReactNode;
  unit?: string;
}) => (
  <span className="os-num text-[17px]" style={{ letterSpacing: '-.02em' }}>
    {children}
    {unit && <small className="os-t ml-1 text-[12px]">{unit}</small>}
  </span>
);

export function SettingsScreen() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const settings = useSettings();
  const profile = useProfile();
  const mode = useThemeStore((s) => s.selection.mode);
  const setTheme = useThemeStore((s) => s.update);
  const storage = usePersistentStorage();
  const goalCount = useLiveQuery(() =>
    db.goals.filter((g) => g.status === 'active').count(),
  );
  const workouts = useLiveQuery(() =>
    db.sessions.where('status').equals('completed').count(),
  );
  const sets = useLiveQuery(() => db.sets.toArray());
  const latestBw = useLiveQuery(async () => {
    const rows = await db.measurements
      .filter((m) => m.type === 'bodyweight' && m.valueLb !== undefined)
      .toArray();
    return rows.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  });
  const { lifted, records } = useMemo(() => {
    let lifted = 0;
    let records = 0;
    for (const s of sets ?? []) {
      if (s.deletedAt || !s.completed) continue;
      if (s.type === 'working' || s.type === 'amrap')
        lifted += Math.max(0, s.weightLb) * s.reps;
      if (s.isPR?.length) records++;
    }
    return { lifted, records };
  }, [sets]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  // Import replaces everything, so a picked file waits here for an explicit confirm.
  const [pendingImport, setPendingImport] = useState<File | null>(null);

  const units = settings.units;
  const profileSummary = (() => {
    if (!profile) return 'Not set up yet';
    const parts: string[] = [];
    if (profile.sex)
      parts.push(profile.sex[0]!.toUpperCase() + profile.sex.slice(1));
    const age = ageFromBirthDate(profile.birthDate, nowIso());
    if (age !== undefined) parts.push(String(age));
    if (profile.heightIn != null) {
      const { ft, in: inch } = inToFtIn(profile.heightIn);
      parts.push(`${ft}'${inch}"`);
    }
    return parts.length ? parts.join(' · ') : 'Tap to fill in';
  })();

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
    setPendingImport(null);
    try {
      await importFromJson(await file.text());
      setFeedback(
        'Data replaced. Your previous data was saved as a snapshot on this device.',
      );
    } catch (err) {
      setFeedback(
        err instanceof ImportError ? err.message : 'Could not read that file.',
      );
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const restByType = `Compound ${clock(settings.restCompoundSec)} · isolation ${clock(settings.restIsolationSec)} · accessory ${clock(settings.restAccessorySec)}`;

  return (
    <div className="relative flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-[120px] pt-2">
        <ScreenTitle eyebrow="Settings and data" title="You" />

        <div className="mt-3.5">
          <StatTiles
            cols={3}
            size={24}
            stats={[
              { label: 'Workouts', value: workouts ?? 0 },
              {
                label: 'Lifted',
                value: compact(toUnit(lifted, units)),
                unit: units,
              },
              {
                label: 'Records',
                value: records,
                color: records > 0 ? 'var(--pr)' : undefined,
              },
            ]}
          />
        </div>

        <SectionHead>Units</SectionHead>
        <div className="os-seg" role="radiogroup" aria-label="Weight unit">
          {(['lb', 'kg'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={units === u}
              onClick={() => void updateSettings({ units: u })}
            >
              {u === 'lb' ? 'Pounds' : 'Kilograms'}
            </button>
          ))}
        </div>

        <SectionHead>Appearance</SectionHead>
        <div className="os-seg" role="radiogroup" aria-label="Appearance">
          {(['dark', 'light'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setTheme({ mode: m })}
            >
              {m === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
        </div>

        <SectionHead>Training</SectionHead>
        <div className="os-card" style={{ padding: '4px 16px' }}>
          <Row
            label="Default rest"
            sub="For new exercises"
            value={<Value>{clock(settings.defaultRestWorkSec)}</Value>}
            onClick={() => navigate('/rest-defaults')}
          />
          <Row
            label="Bar and plates"
            sub={`${fmtWeight(settings.barLb, units)} ${units} bar · ${settings.plateInventoryLb.length} plate sizes`}
            value={
              <PlateMarks
                platesLb={settings.plateInventoryLb}
                units={units}
                sleeve={false}
                label={`${settings.plateInventoryLb.length} plate sizes`}
              />
            }
            onClick={() => navigate('/plates')}
          />
          <Row
            label="Rest by lift type"
            sub={restByType}
            onClick={() => navigate('/rest-defaults')}
          />
        </div>

        <SectionHead>Body</SectionHead>
        <div className="os-card" style={{ padding: '4px 16px' }}>
          <Row
            label="Profile"
            sub={profileSummary}
            onClick={() => navigate('/profile')}
          />
          <Row
            label="Bodyweight"
            sub={
              latestBw ? `Logged ${monthDay(latestBw.date)}` : 'Not logged yet'
            }
            value={
              latestBw?.valueLb !== undefined ? (
                <Value unit={units}>{fmtWeight(latestBw.valueLb, units)}</Value>
              ) : undefined
            }
            onClick={() => navigate('/measurements')}
          />
          <Row
            label="Goals"
            sub={`${goalCount ?? 0} active`}
            onClick={() => navigate('/goals')}
          />
          <Row
            label="Measurements"
            sub="Waist, arms, photos"
            onClick={() => navigate('/measurements')}
          />
        </div>

        <SectionHead>Your data</SectionHead>
        <div className="os-card" style={{ padding: '4px 16px' }}>
          <Row
            label="Export backup"
            sub="Everything, as one JSON file"
            onClick={() => void downloadEnvelope(nowIso())}
          />
          <Row
            label="Import backup"
            sub="Asks before replacing anything"
            onClick={() => fileRef.current?.click()}
          />
          <Row
            label="Load sample data"
            sub="A demo program with six weeks of history"
            onClick={() => {
              if (!catalog) return;
              void seedSampleData(catalog, nowIso()).then(() =>
                setFeedback(
                  'Sample data loaded. It is now the active program.',
                ),
              );
            }}
          />
          <Row
            label="Erase all data"
            onClick={() => setConfirmErase(true)}
            danger
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import backup file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFeedback(null);
              setPendingImport(f);
            }
          }}
        />
        {feedback && (
          <p role="status" className="os-t mt-2.5 text-center leading-snug">
            {feedback}
          </p>
        )}

        {storage.supported && (
          <div className="os-t mt-3 flex items-center justify-between gap-3 px-1 leading-snug">
            <span>
              {storage.persisted
                ? 'Storage is persistent'
                : 'Storage is best effort'}
              {storage.usageBytes !== null
                ? ` · ${fmtBytes(storage.usageBytes)} used`
                : ''}
            </span>
            {!storage.persisted && (
              <button
                type="button"
                onClick={() => void storage.request()}
                className="os-press min-h-11 flex-none px-1 font-bold"
                style={{ color: 'var(--acc-tx)' }}
              >
                Make persistent
              </button>
            )}
          </div>
        )}

        <div className="os-card mt-3 flex items-start gap-3">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--pos)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-none"
            aria-hidden
          >
            <path d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <div>
            <div className="text-[14px] font-extrabold">Private by default</div>
            <div className="os-t mt-0.5 font-medium leading-[1.4]">
              {t.settings.privacy}
            </div>
          </div>
        </div>
        <p className="os-t mt-4 text-center leading-snug">
          {t.settings.disclaimer}
          <br />
          v1.0 · MIT · free-exercise-db
        </p>
      </div>

      <ConfirmSheet
        open={pendingImport !== null}
        title="Replace all data?"
        body={`Every workout, program and setting on this device will be replaced with ${pendingImport?.name ?? 'the file'}. Your current data is saved as a snapshot first.`}
        cta="Replace data"
        onConfirm={() => pendingImport && void handleImport(pendingImport)}
        onClose={() => {
          setPendingImport(null);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      <ConfirmSheet
        open={confirmErase}
        title="Erase all data?"
        body="Every workout, program, measurement, goal and setting on this device goes. The app reloads like a fresh install. This cannot be undone."
        cta="Erase everything"
        onConfirm={() => void resetAll()}
        onClose={() => setConfirmErase(false)}
      />
    </div>
  );
}
