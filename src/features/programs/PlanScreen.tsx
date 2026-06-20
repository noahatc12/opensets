import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { setActiveProgram } from '../../db/repositories';

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

export function PlanScreen() {
  useCatalog();
  const navigate = useNavigate();
  const programs = useLiveQuery(() => db.programs.toArray());
  const templates = useLiveQuery(() => db.templates.toArray());

  return (
    <div className="h-full overflow-auto px-[22px] pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div
          className="text-[30px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-tight)' }}
        >
          Plan
        </div>
        <Button className="min-h-10 px-4" onClick={() => navigate('/routine/new')}>
          + New
        </Button>
      </div>

      {!programs?.length ? (
        <EmptyState
          title="No routines yet"
          body="Build a routine and OpenSets will program your progression."
          action={<Button onClick={() => navigate('/routine/new')}>Build a routine</Button>}
        />
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {programs.map((p) => {
            const tpls = (templates ?? []).filter((t) => t.programId === p.id);
            const slots = tpls.flatMap((t) => t.slots);
            return (
              <div
                key={p.id}
                className="rounded-[var(--r-xl)] border bg-surface p-5"
                style={{ borderColor: 'var(--border-card)', boxShadow: 'var(--hairline-top)' }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[18px] font-bold text-text"
                    style={{ letterSpacing: 'var(--tracking-snug)' }}
                  >
                    {p.name}
                  </span>
                  {p.isActive ? (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => void setActiveProgram(p.id)}
                      className="text-[12px] font-semibold text-muted"
                    >
                      Make active
                    </button>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-muted">
                  {tpls.length} day{tpls.length === 1 ? '' : 's'} · {slots.length} exercises
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {slots.slice(0, 4).map((s, i) => (
                    <span
                      key={i}
                      className="rounded-[var(--r-pill)] bg-bg px-[11px] py-1.5 text-[12px] text-muted"
                    >
                      {nameOf(s.exerciseId)}
                    </span>
                  ))}
                  {slots.length > 4 && (
                    <span className="rounded-[var(--r-pill)] bg-bg px-[11px] py-1.5 text-[12px] text-muted">
                      +{slots.length - 4}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
