import { useNav } from '../../ui/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useProfile } from '../../db/hooks';
import { latestBodyweightLb } from '../../db/repositories';
import { proteinTarget } from '../../engine/body';
import { ageFromBirthDate } from '../../lib/age';

/**
 * Daily protein target (spec §5.3), display only: no macros, no meal logging
 * (standing rule). 1.6 to 2.2 g per kg from the latest bodyweight; at BMI 30+ the
 * basis is a height-adjusted weight. Framed as an estimate, never a prescription.
 */
export function ProteinCard() {
  const nav = useNav();
  const profile = useProfile();
  // Re-read whenever the measurements change (useLiveQuery tracks the table).
  const bodyweightLb = useLiveQuery(async () => {
    await db.measurements.count();
    return (await latestBodyweightLb()) ?? null;
  });
  if (bodyweightLb === undefined) return null; // loading

  const target =
    bodyweightLb === null
      ? null
      : proteinTarget({
          bodyweightLb,
          heightIn: profile?.heightIn,
          ageYears: ageFromBirthDate(
            profile?.birthDate,
            new Date().toISOString(),
          ),
        });

  if (!target) {
    return (
      <button
        type="button"
        onClick={() => nav.push('/measurements')}
        className="os-card os-press mt-3 block w-full text-left"
        style={{ padding: '14px 16px' }}
      >
        <span className="os-t">Protein</span>
        <span
          className="mt-1 block text-[14px] font-semibold leading-snug"
          style={{ color: 'var(--ink2)' }}
        >
          Add your bodyweight in Measurements to see a daily protein target.
        </span>
      </button>
    );
  }

  return (
    <div className="os-card mt-3" style={{ padding: '14px 16px' }}>
      <div className="flex items-baseline justify-between">
        <span className="os-t">Protein, per day</span>
        <span className="os-t">an estimate</span>
      </div>
      <div
        className="mt-1.5 text-[20px] font-extrabold"
        style={{ letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}
      >
        At least {target.lowG} g a day
      </div>
      <p
        className="mt-1 text-[12px] font-medium leading-snug"
        style={{ color: 'var(--mute)' }}
      >
        {/* One number to act on: the benefit levels off near 1.6 g per kg (Morton
            2018), so the low end leads and the range follows (review 2026-10-14). */}
        Up to {target.highG} g is fine.{' '}
        {target.basis === 'heightAdjusted'
          ? 'From a height-adjusted weight, 1.6 to 2.2 g per kg.'
          : 'From your bodyweight, 1.6 to 2.2 g per kg.'}{' '}
        A starting point, not medical advice.
      </p>
      {target.underEighteen && (
        <p
          className="mt-1 text-[12px] font-medium leading-snug"
          style={{ color: 'var(--mute)' }}
        >
          Under 18: check with a doctor or registered dietitian before changing
          how you eat.
        </p>
      )}
    </div>
  );
}
