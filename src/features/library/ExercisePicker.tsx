import { useMemo, useState } from 'react';
import { useCatalog } from './useCatalog';
import { searchCatalog } from '../../db/catalog';
import type { Exercise } from '../../db/types';

interface Props {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}

/** Full-screen exercise search/picker (spec §7). Substring filter over the catalog. */
export function ExercisePicker({ onPick, onClose }: Props) {
  const catalog = useCatalog();
  const [q, setQ] = useState('');
  const results = useMemo(
    () => (catalog ? searchCatalog(catalog, q) : []),
    [catalog, q],
  );

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-border px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 873 exercises…"
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-[15px] text-text placeholder:text-faint focus:border-border-strong focus:outline-none"
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
      ) : (
        <ul className="flex-1 overflow-y-auto px-2 py-2">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onPick(e)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="text-[15px] font-medium text-text">
                  {e.name}
                </span>
                <span className="text-[12px] capitalize text-faint">
                  {[e.primaryMuscles[0], e.equipment]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="p-6 text-center text-sm text-muted">No matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}
