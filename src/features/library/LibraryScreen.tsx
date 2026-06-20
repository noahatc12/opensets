import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatalog } from './useCatalog';
import { searchCatalog } from '../../db/catalog';
import type { Exercise } from '../../db/types';
import { SearchIcon, ChevronRightIcon } from '../../components/icons';

/* Ported from the Tempo prototype Library screen: title + New, search field,
   facet chips, exercise rows (thumbnail + name + muscle·equipment·mechanic). */

const FACETS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Barbell', 'Dumbbell'];

function ExerciseThumb({ ex }: { ex: Exercise }) {
  const [failed, setFailed] = useState(false);
  const src = ex.images[0];
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-[46px] rounded-[var(--r-sm)] object-cover"
        style={{ background: 'var(--bg)' }}
      />
    );
  }
  return (
    <div
      className="grid size-[46px] place-items-center rounded-[var(--r-sm)] text-faint"
      style={{ background: 'var(--bg)', border: '1px dashed var(--border-strong)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path d="M5 17l4.5-4 3 2.5L17 11l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const titleCase = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

export function LibraryScreen() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const [facet, setFacet] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!catalog) return [];
    let list = searchCatalog(catalog, query, catalog.length);
    if (facet) {
      const f = facet.toLowerCase();
      list = list.filter(
        (e) =>
          e.primaryMuscles.some((m) => m.toLowerCase().includes(f)) ||
          e.equipment?.toLowerCase().includes(f) ||
          (f === 'legs' &&
            e.primaryMuscles.some((m) =>
              ['quadriceps', 'hamstrings', 'glutes', 'calves'].includes(m),
            )) ||
          (f === 'arms' &&
            e.primaryMuscles.some((m) =>
              ['biceps', 'triceps', 'forearms'].includes(m),
            )) ||
          (f === 'back' &&
            e.primaryMuscles.some((m) =>
              ['lats', 'middleBack', 'lowerBack', 'traps'].includes(m),
            )),
      );
    }
    return list;
  }, [catalog, query, facet]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-[22px] pb-1.5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div
            className="text-[30px] font-bold text-text"
            style={{ letterSpacing: 'var(--tracking-tight)' }}
          >
            Library
          </div>
          <span className="rounded-[var(--r-md)] bg-surface px-3.5 py-2 text-[13px] font-semibold text-faint">
            {catalog ? `${catalog.length} exercises` : '…'}
          </span>
        </div>
        <div
          className="mt-3.5 flex h-[46px] items-center gap-2.5 rounded-[var(--r-md)] border px-3.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        >
          <SearchIcon className="size-[18px] text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            className="h-full flex-1 bg-transparent text-[14px] text-text placeholder:text-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="os-scroll flex flex-none gap-2 overflow-x-auto px-[22px] pb-1.5 pt-2">
        <button
          onClick={() => setFacet(null)}
          className="flex-none rounded-[var(--r-pill)] px-[13px] py-[7px] text-[12px] font-semibold"
          style={
            facet === null
              ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
              : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border-card)' }
          }
        >
          All
        </button>
        {FACETS.map((f) => (
          <button
            key={f}
            onClick={() => setFacet(facet === f ? null : f)}
            className="flex-none rounded-[var(--r-pill)] px-[13px] py-[7px] text-[12px]"
            style={
              facet === f
                ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }
                : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border-card)' }
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-24 pt-1.5">
        {catalog === null ? (
          <p className="p-6 text-center text-[13px] text-muted">Loading library…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((ex) => (
              <button
                key={ex.id}
                onClick={() => navigate(`/library/${encodeURIComponent(ex.id)}`)}
                className="flex w-full items-center gap-3.5 rounded-[var(--r-md)] border bg-surface py-2.5 pl-2.5 pr-3.5 text-left"
                style={{ borderColor: 'var(--border-card)' }}
              >
                <ExerciseThumb ex={ex} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold text-text">
                    {ex.name}
                  </div>
                  <div className="truncate text-[12px] text-muted">
                    {[titleCase(ex.primaryMuscles[0]), titleCase(ex.equipment), titleCase(ex.mechanic)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <ChevronRightIcon className="size-[18px] text-faint" />
              </button>
            ))}
            {results.length === 0 && (
              <p className="p-6 text-center text-[13px] text-muted">No matches.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
