import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  return (
    <div
      className="mt-3 rounded-[var(--r-xl)] border bg-surface p-5"
      style={{ borderColor: 'var(--border-card)' }}
    >
      <span
        className="text-[11px] font-bold uppercase text-muted"
        style={{
          letterSpacing: 'var(--tracking-caps)',
          fontFamily: 'var(--font-label)',
        }}
      >
        Protein
      </span>
      {target ? (
        <>
          <div className="mt-1.5 text-[20px] font-bold text-text">
            {target.lowG} to {target.highG} g a day
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">
            {target.basis === 'heightAdjusted'
              ? 'Based on a height-adjusted weight, 1.6 to 2.2 g per kg.'
              : 'Based on your bodyweight, 1.6 to 2.2 g per kg.'}{' '}
            An estimate to start from, not medical advice.
          </p>
          {target.underEighteen && (
            <p className="mt-1 text-[12px] leading-snug text-muted">
              Under 18: check with a doctor or registered dietitian before
              changing how you eat.
            </p>
          )}
        </>
      ) : (
        <button
          onClick={() => navigate('/measurements')}
          className="mt-1.5 block text-left text-[13px] leading-snug text-muted"
        >
          Add your bodyweight in Measurements to see a daily protein target.
        </button>
      )}
    </div>
  );
}
