import { useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useCatalog, useSearchIndex } from './useCatalog';
import { searchCatalog, getCatalogExercise } from '../../db/catalog';
import { searchIds } from '../../db/searchIndex';
import type { Exercise } from '../../db/types';

interface Props {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Full-screen exercise search/picker (spec §7). Index-backed muscle-aware search
 *  (synonym layer) with a name substring fallback while the index loads, over a
 *  list virtualized across the full ~873 dataset. */
export function ExercisePicker({ onPick, onClose }: Props) {
  const catalog = useCatalog();
  const index = useSearchIndex();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    if (!catalog) return [];
    const query = q.trim();
    if (!query) return catalog;
    if (index) {
      return searchIds(index, query, 100)
        .map((id) => getCatalogExercise(id))
        .filter((e): e is Exercise => Boolean(e));
    }
    return searchCatalog(catalog, query, catalog.length);
  }, [catalog, index, q]);

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search exercises or muscles…"
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-[16px] text-text placeholder:text-faint focus:border-border-strong focus:outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-3 text-[15px] text-muted hover:text-text"
        >
          Cancel
        </button>
      </header>
      {catalog === null ? (
        <p className="p-6 text-center text-sm text-muted">Loading library…</p>
      ) : results.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">No matches.</p>
      ) : (
        <Virtuoso
          className="flex-1"
          data={results}
          itemContent={(_, e) => (
            <div className="px-2">
              <button
                type="button"
                onClick={() => onPick(e)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="text-[15px] font-medium text-text">{e.name}</span>
                <span className="text-[12px] capitalize text-faint">
                  {[e.primaryMuscles[0], e.equipment].filter(Boolean).join(' · ')}
                </span>
              </button>
            </div>
          )}
        />
      )}
    </div>
  );
}
