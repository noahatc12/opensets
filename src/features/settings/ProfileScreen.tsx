import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { updateProfile } from '../../db/hooks';
import { ChevronLeftIcon } from '../../components/icons';
import { inToFtIn, ftInToIn } from '../../lib/units';
import type { BiologicalSex, Profile, ProfileRow } from '../../db/types';

/* Settings → Profile (spec §6.6 input). Shows and edits the captured profile:
   sex, date of birth, height (ft/in), body fat %, training goal + physique target.
   Height is canonical inches; bodyweight is NOT here (it's a measurement). Fields
   persist on change (toggles/goal) or blur (number/date inputs). The editable form
   is a keyed child seeded from the persisted row via props — no setState-in-effect. */

const GOALS = ['Build muscle', 'Lose fat', 'Recomposition', 'Get stronger'] as const;

const numFont = { fontFamily: 'var(--font-num)' as const };

const cardSel = (active: boolean) =>
  active
    ? { background: 'var(--accent)', color: 'var(--accent-ink)' as const, border: '1px solid transparent' }
    : { background: 'var(--surface)', color: 'var(--text)' as const, border: '1px solid var(--border-card)' };

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2 mt-[22px] text-[11px] font-bold uppercase text-faint"
      style={{ letterSpacing: 'var(--tracking-caps)', fontFamily: 'var(--font-label)' }}
    >
      {children}
    </div>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--r-md)] border px-4 py-3.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      {children}
    </div>
  );
}

const inputCls =
  'min-w-0 flex-1 bg-transparent text-[18px] text-text placeholder:text-faint focus:outline-none';

export function ProfileScreen() {
  const navigate = useNavigate();
  // undefined = still loading; null = no profile yet; row = loaded.
  const loaded = useLiveQuery(() => db.profile.get('user').then((p) => p ?? null));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={() => navigate('/settings')} className="grid size-10 place-items-center bg-transparent text-muted" aria-label="Back">
          <ChevronLeftIcon className="size-[22px]" />
        </button>
        <div className="text-[22px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
          Profile
        </div>
      </div>

      {loaded !== undefined && (
        // Remount when the persisted row's identity changes so the form re-seeds.
        <ProfileForm key={loaded?.updatedAt ?? 'new'} initial={loaded} />
      )}
    </div>
  );
}

/** Editable form, state seeded once from `initial` props (lazy useState — no effect). */
function ProfileForm({ initial }: { initial: ProfileRow | null }) {
  const h = initial?.heightIn != null ? inToFtIn(initial.heightIn) : null;
  const [sex, setSex] = useState<BiologicalSex | null>(initial?.sex ?? null);
  const [dob, setDob] = useState(initial?.birthDate ?? '');
  const [heightFt, setHeightFt] = useState(h ? String(h.ft) : '');
  const [heightInch, setHeightInch] = useState(h ? String(h.in) : '');
  const [bodyFat, setBodyFat] = useState(
    initial?.bodyFatPct != null ? String(initial.bodyFatPct) : '',
  );
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [targetBodyFat, setTargetBodyFat] = useState(
    initial?.targetBodyFatPct != null ? String(initial.targetBodyFatPct) : '',
  );
  const [timeframeWeeks, setTimeframeWeeks] = useState(
    initial?.goalTimeframeWeeks != null ? String(initial.goalTimeframeWeeks) : '',
  );

  const save = (patch: Partial<Profile>) => void updateProfile(patch);

  const numOrUndef = (s: string): number | undefined => {
    const n = parseFloat(s);
    return Number.isNaN(n) || n <= 0 ? undefined : n;
  };

  function saveHeight() {
    const ft = parseInt(heightFt, 10);
    const inch = parseInt(heightInch, 10);
    const hIn = ftInToIn(Number.isNaN(ft) ? 0 : ft, Number.isNaN(inch) ? 0 : inch);
    save({ heightIn: hIn > 0 ? hIn : undefined });
  }

  return (
    <div className="os-scroll flex-1 overflow-auto px-[22px] pb-10 pt-1.5">
      <p className="text-[13px] leading-relaxed text-muted">
        Used to personalize your plan and (later) calorie/protein targets. Everything
        is optional and stays on your device.
      </p>

      <Label>Sex</Label>
      <div className="flex gap-2.5">
        {(['male', 'female'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              const next = sex === s ? null : s;
              setSex(next);
              save({ sex: next ?? undefined });
            }}
            className="flex-1 rounded-[var(--r-md)] px-4 py-3.5 text-[14px] font-bold capitalize"
            style={cardSel(sex === s)}
          >
            {s}
          </button>
        ))}
      </div>

      <Label>Date of birth</Label>
      <Box>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          onBlur={() => save({ birthDate: dob || undefined })}
          aria-label="Date of birth"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-text placeholder:text-faint focus:outline-none"
          style={numFont}
        />
      </Box>

      <Label>Height</Label>
      <div className="flex gap-2.5">
        <Box>
          <input
            type="number"
            inputMode="numeric"
            value={heightFt}
            onChange={(e) => setHeightFt(e.target.value)}
            onBlur={saveHeight}
            placeholder="—"
            aria-label="Height feet"
            className={inputCls}
            style={numFont}
          />
          <span className="text-[14px] text-muted">ft</span>
        </Box>
        <Box>
          <input
            type="number"
            inputMode="numeric"
            value={heightInch}
            onChange={(e) => setHeightInch(e.target.value)}
            onBlur={saveHeight}
            placeholder="—"
            aria-label="Height inches"
            className={inputCls}
            style={numFont}
          />
          <span className="text-[14px] text-muted">in</span>
        </Box>
      </div>

      <Label>Body fat %</Label>
      <Box>
        <input
          type="number"
          inputMode="decimal"
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
          onBlur={() => save({ bodyFatPct: numOrUndef(bodyFat) })}
          placeholder="—"
          aria-label="Body fat percent"
          className={inputCls}
          style={numFont}
        />
        <span className="text-[14px] text-muted">%</span>
      </Box>

      <Label>Goal</Label>
      <div className="flex flex-col gap-2.5">
        {GOALS.map((g) => (
          <button
            key={g}
            onClick={() => {
              setGoal(g);
              save({ goal: g });
            }}
            className="rounded-[var(--r-md)] px-[18px] py-3.5 text-left text-[14px] font-bold"
            style={cardSel(goal === g)}
          >
            {g}
          </button>
        ))}
      </div>

      <Label>Goal target · optional</Label>
      <p className="mb-2 text-[12px] leading-relaxed text-muted">
        For a physique target — e.g. reach 12% body fat in 8 weeks.
      </p>
      <div className="flex gap-2.5">
        <Box>
          <input
            type="number"
            inputMode="decimal"
            value={targetBodyFat}
            onChange={(e) => setTargetBodyFat(e.target.value)}
            onBlur={() => save({ targetBodyFatPct: numOrUndef(targetBodyFat) })}
            placeholder="—"
            aria-label="Target body fat percent"
            className={inputCls}
            style={numFont}
          />
          <span className="text-[13px] text-muted">% BF</span>
        </Box>
        <Box>
          <input
            type="number"
            inputMode="numeric"
            value={timeframeWeeks}
            onChange={(e) => setTimeframeWeeks(e.target.value)}
            onBlur={() => save({ goalTimeframeWeeks: numOrUndef(timeframeWeeks) })}
            placeholder="—"
            aria-label="Goal timeframe weeks"
            className={inputCls}
            style={numFont}
          />
          <span className="text-[13px] text-muted">weeks</span>
        </Box>
      </div>

      <p className="mx-1 mt-6 text-[11px] leading-snug text-faint">
        Height is stored in inches and shown in feet/inches. Bodyweight lives under
        Body measurements.
      </p>
    </div>
  );
}
