import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ChevronRightIcon, DumbbellIcon, PlusIcon } from '../../components/icons';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import {
  getActiveProgram,
  listTemplates,
  setActiveProgram,
} from '../../db/repositories';
import { db } from '../../db/db';

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

export function PlanScreen() {
  useCatalog();
  const navigate = useNavigate();
  const programs = useLiveQuery(() => db.programs.toArray());
  const activeProgram = useLiveQuery(() => getActiveProgram());
  const activeTemplates = useLiveQuery(
    () => (activeProgram ? listTemplates(activeProgram.id) : Promise.resolve([])),
    [activeProgram?.id],
  );

  return (
    <div className="h-full overflow-auto px-[22px] pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between py-2">
        <div
          className="text-[30px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-tight)' }}
        >
          Programs
        </div>
        <button
          onClick={() => navigate('/routine/new')}
          className="flex h-10 items-center gap-1.5 rounded-[var(--r-md)] px-4 text-[13px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          <PlusIcon className="size-4" />
          New
        </button>
      </div>

      {!programs?.length ? (
        <EmptyState
          title="No routines yet"
          body="Build a routine and OpenSets will program your progression."
          action={<Button onClick={() => navigate('/routine/new')}>Build a routine</Button>}
        />
      ) : activeProgram ? (
        <ActiveProgramView
          name={activeProgram.name}
          dayCount={activeTemplates?.length ?? 0}
          meso={
            activeProgram.mesocycle
              ? {
                  week: activeProgram.mesocycle.weekIndex,
                  total: activeProgram.mesocycle.totalWeeks,
                }
              : undefined
          }
          templates={(activeTemplates ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            previews: t.slots.slice(0, 4).map((s) => nameOf(s.exerciseId)),
            extra: Math.max(0, t.slots.length - 4),
            exerciseCount: t.slots.length,
          }))}
          onOpenBuilder={() => navigate('/routine/new')}
          onGenerate={() => navigate('/onboarding')}
        />
      ) : (
        <InactiveProgramsView
          programs={programs.map((p) => ({ id: p.id, name: p.name }))}
          onMakeActive={(id) => void setActiveProgram(id)}
          onGenerate={() => navigate('/onboarding')}
        />
      )}
    </div>
  );
}

interface TemplateRow {
  id: string;
  name: string;
  previews: string[];
  extra: number;
  exerciseCount: number;
}

function ActiveProgramView({
  name,
  dayCount,
  meso,
  templates,
  onOpenBuilder,
  onGenerate,
}: {
  name: string;
  dayCount: number;
  meso?: { week: number; total: number };
  templates: TemplateRow[];
  onOpenBuilder: () => void;
  onGenerate: () => void;
}) {
  const dayLabel = `${dayCount} day${dayCount === 1 ? '' : 's'}`;
  return (
    <div className="mt-2">
      {/* active program */}
      <button
        onClick={onOpenBuilder}
        className="w-full rounded-[var(--r-xl)] bg-surface p-[18px] text-left"
        style={{
          border: '1.5px solid var(--accent)',
          boxShadow: 'var(--hairline-top)',
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase text-accent"
            style={{
              letterSpacing: 'var(--tracking-caps)',
              fontFamily: 'var(--font-label)',
            }}
          >
            Active
          </span>
          <span
            className="text-[11px] text-muted"
            style={{
              fontFamily: 'var(--font-num)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {meso ? `${dayLabel} · wk ${meso.week} of ${meso.total}` : dayLabel}
          </span>
        </div>
        <div
          className="mt-2 text-[21px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          {name}
        </div>
        {templates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <span
                key={t.id}
                className="rounded-[var(--r-pill)] bg-bg px-[11px] py-1.5 text-[12px] text-muted"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* all routines */}
      <div
        className="mx-1 mb-2.5 mt-[22px] text-[11px] font-bold uppercase text-faint"
        style={{
          letterSpacing: 'var(--tracking-caps)',
          fontFamily: 'var(--font-label)',
        }}
      >
        All routines
      </div>
      <div className="flex flex-col gap-2">
        {templates.length === 0 ? (
          <div className="rounded-[var(--r-md)] border bg-surface px-4 py-3.5 text-[13px] text-muted"
            style={{ borderColor: 'var(--border-card)' }}
          >
            No days in this program yet.
          </div>
        ) : (
          templates.map((t) => (
            <button
              key={t.id}
              onClick={onOpenBuilder}
              className="flex w-full items-center gap-3.5 rounded-[var(--r-md)] border bg-surface px-4 py-3.5 text-left"
              style={{ borderColor: 'var(--border-card)' }}
            >
              <div
                className="flex size-[38px] items-center justify-center rounded-[var(--r-sm)] bg-bg text-accent"
              >
                <DumbbellIcon className="size-[18px]" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-text">{t.name}</div>
                <div className="text-[12px] text-muted">
                  {t.exerciseCount} exercise{t.exerciseCount === 1 ? '' : 's'}
                </div>
              </div>
              <ChevronRightIcon className="size-[18px] text-faint" />
            </button>
          ))
        )}
      </div>

      <GenerateCta onGenerate={onGenerate} />
    </div>
  );
}

function InactiveProgramsView({
  programs,
  onMakeActive,
  onGenerate,
}: {
  programs: { id: string; name: string }[];
  onMakeActive: (id: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="mt-2">
      <div
        className="mx-1 mb-2.5 text-[11px] font-bold uppercase text-faint"
        style={{
          letterSpacing: 'var(--tracking-caps)',
          fontFamily: 'var(--font-label)',
        }}
      >
        All routines
      </div>
      <div className="flex flex-col gap-2">
        {programs.map((p) => (
          <button
            key={p.id}
            onClick={() => onMakeActive(p.id)}
            className="flex w-full items-center gap-3.5 rounded-[var(--r-md)] border bg-surface px-4 py-3.5 text-left"
            style={{ borderColor: 'var(--border-card)' }}
          >
            <div className="flex size-[38px] items-center justify-center rounded-[var(--r-sm)] bg-bg text-accent">
              <DumbbellIcon className="size-[18px]" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-text">{p.name}</div>
              <div className="text-[12px] text-muted">Tap to make active</div>
            </div>
            <ChevronRightIcon className="size-[18px] text-faint" />
          </button>
        ))}
      </div>
      <GenerateCta onGenerate={onGenerate} />
    </div>
  );
}

function GenerateCta({ onGenerate }: { onGenerate: () => void }) {
  return (
    <button
      onClick={onGenerate}
      className="mt-[18px] h-[52px] w-full rounded-[var(--r-md)] bg-transparent text-[14px] font-semibold text-muted"
      style={{ border: '1px dashed var(--border-strong)' }}
    >
      Generate a plan from your goals
    </button>
  );
}
