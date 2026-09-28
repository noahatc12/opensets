import { useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useCatalog, useSearchIndex } from './useCatalog';
import { useBestE1rm } from './useBestE1rm';
import { MUSCLE_GROUPS, inGroup } from './muscleGroups';
import { searchCatalog, getCatalogExercise } from '../../db/catalog';
import { searchIds } from '../../db/searchIndex';
import { useSettings } from '../../db/hooks';
import { roundDisplay, toUnit } from '../../lib/units';
import { titleCase } from '../../lib/format';
import { Sheet, SheetHeader } from '../../ui/Sheet';
import type { Exercise } from '../../db/types';

interface Props {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/** The Add exercise sheet (spec §7): index-backed muscle-aware search with a name
 *  substring fallback while the index loads, muscle chips, a list virtualized across the
 *  full catalog, each row with the lifter's best e1RM when one is logged. */
export function ExercisePicker({ onPick, onClose }: Props) {
  const catalog = useCatalog();
  const index = useSearchIndex();
  const { units } = useSettings();
  const { best } = useBestE1rm();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');

  const results = useMemo(() => {
    if (!catalog) return [];
    const query = q.trim();
    let base: Exercise[];
    if (!query) base = catalog;
    else if (index)
      base = searchIds(index, query, 100)
        .map((id) => getCatalogExercise(id))
        .filter((e): e is Exercise => Boolean(e));
    else base = searchCatalog(catalog, query, catalog.length);
    return group === 'all'
      ? base
      : base.filter((e) =>
          inGroup(group, e.primaryMuscles, e.secondaryMuscles),
        );
  }, [catalog, index, q, group]);

  return (
    <Sheet open onClose={onClose} label="Add exercise" height="78%">
      <SheetHeader title="Add exercise" action="Cancel" onAction={onClose} />
      <div
        className="mt-3 flex h-[46px] flex-none items-center gap-2.5 rounded-[14px] px-3.5"
        style={{
          background: 'var(--bg)',
          boxShadow: 'inset 0 1px 0 rgba(0,0,0,.4)',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--mute)"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            catalog ? `Search ${catalog.length} exercises` : 'Search exercises'
          }
          aria-label="Search exercises"
          className="os-input text-[15px]"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Clear search"
            className="os-t px-1"
          >
            Clear
          </button>
        )}
      </div>
      <div className="os-chips mt-2.5 flex-none">
        {[{ key: 'all', label: 'All' }, ...MUSCLE_GROUPS].map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            aria-pressed={group === g.key}
            className={`os-chip os-press ${group === g.key ? 'os-chip--on' : ''}`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="mt-1.5 min-h-0 flex-1">
        {catalog === null ? (
          <p className="os-t p-6 text-center">Loading library…</p>
        ) : results.length === 0 ? (
          <p className="os-t p-6 text-center">
            No exercise matches. Try another word or clear the filter.
          </p>
        ) : (
          <Virtuoso
            className="h-full"
            data={results}
            itemContent={(_, e) => {
              const b = best.get(e.id);
              return (
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="os-row os-press"
                  aria-label={`Add ${e.name}`}
                >
                  <Thumb ex={e} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {e.name}
                    </span>
                    <span
                      className="mt-0.5 block truncate text-[12px] font-medium"
                      style={{ color: 'var(--mute)' }}
                    >
                      {[
                        titleCase(e.primaryMuscles[0]),
                        titleCase(e.equipment),
                        b
                          ? `best ${roundDisplay(toUnit(b, units), units)}`
                          : 'not logged',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    className="os-chip os-chip--acc grid size-[34px] place-items-center p-0 text-[18px]"
                    aria-hidden
                  >
                    +
                  </span>
                </button>
              );
            }}
          />
        )}
      </div>
    </Sheet>
  );
}

function Thumb({ ex }: { ex: Exercise }) {
  const [failed, setFailed] = useState(false);
  const src = ex.images[0];
  const box = {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--s2)',
    boxShadow: 'inset 0 1px 0 var(--hl)',
    flex: 'none',
  } as const;
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ ...box, objectFit: 'cover' }}
      />
    );
  }
  return <span style={box} aria-hidden />;
}
