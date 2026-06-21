import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { useCatalog, useSearchIndex } from './useCatalog';
import { searchCatalog, getCatalogExercise } from '../../db/catalog';
import { searchIds } from '../../db/searchIndex';
import type { Exercise, Muscle } from '../../db/types';
import { SearchIcon, ChevronRightIcon, CloseIcon } from '../../components/icons';

/* Library browser (spec §7): index-backed search with a synonym layer, a list
   virtualized over the full ~873 dataset, and multi-select facet filters
   (muscle group / equipment / mechanic / level / category) that combine with
   the query. Ported tokens/markup from the prototype Library screen. */

/** Display muscle groups → the canonical muscles they cover. */
const MUSCLE_GROUPS: { key: string; label: string; muscles: Muscle[] }[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'middleBack', 'lowerBack', 'traps'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  {
    key: 'legs',
    label: 'Legs',
    muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors'],
  },
  { key: 'core', label: 'Core', muscles: ['abdominals'] },
];

const titleCase = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
/** "ezBar" → "Ez Bar", "medicineBall" → "Medicine Ball". */
const prettify = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

interface FacetState {
  muscles: Set<string>;
  equipment: Set<string>;
  mechanic: Set<string>;
  level: Set<string>;
  category: Set<string>;
}
type FacetGroup = keyof FacetState;
const emptyFacets = (): FacetState => ({
  muscles: new Set(),
  equipment: new Set(),
  mechanic: new Set(),
  level: new Set(),
  category: new Set(),
});

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

function ExerciseRow({ ex, onOpen }: { ex: Exercise; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3.5 rounded-[var(--r-md)] border bg-surface py-2.5 pl-2.5 pr-3.5 text-left"
      style={{ borderColor: 'var(--border-card)' }}
    >
      <ExerciseThumb ex={ex} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold text-text">{ex.name}</div>
        <div className="truncate text-[12px] text-muted">
          {[titleCase(ex.primaryMuscles[0]), titleCase(ex.equipment), titleCase(ex.mechanic)]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <ChevronRightIcon className="size-[18px] text-faint" />
    </button>
  );
}

/** A multi-select chip used inline and in the filter sheet. */
function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex-none rounded-[var(--r-pill)] px-[13px] py-[7px] text-[12px] font-semibold"
      style={
        active
          ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
          : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border-card)' }
      }
    >
      {label}
    </button>
  );
}

function FilterSection({
  title,
  options,
  selected,
  onToggle,
  labelOf = (v) => v,
}: {
  title: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  labelOf?: (v: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="mb-4">
      <div
        className="mb-2 text-[11px] font-bold uppercase text-faint"
        style={{ fontFamily: 'var(--font-label)', letterSpacing: 'var(--tracking-caps)' }}
      >
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o} label={labelOf(o)} active={selected.has(o)} onClick={() => onToggle(o)} />
        ))}
      </div>
    </div>
  );
}

function FilterSheet({
  facets,
  facetValues,
  onToggle,
  onClear,
  onClose,
  resultCount,
}: {
  facets: FacetState;
  facetValues: { equipment: string[]; mechanic: string[]; level: string[]; category: string[] };
  onToggle: (group: FacetGroup, value: string) => void;
  onClear: () => void;
  onClose: () => void;
  resultCount: number;
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col justify-end"
      style={{ background: 'color-mix(in oklab, var(--bg) 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="max-h-[85%] overflow-auto rounded-t-[var(--r-xl)] border-t px-[22px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full" style={{ background: 'var(--border-strong)' }} />
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[17px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
            Filters
          </div>
          <button onClick={onClear} className="text-[12px] font-semibold text-accent">
            Clear all
          </button>
        </div>

        <FilterSection
          title="Muscle group"
          options={MUSCLE_GROUPS.map((g) => g.key)}
          selected={facets.muscles}
          onToggle={(v) => onToggle('muscles', v)}
          labelOf={(k) => MUSCLE_GROUPS.find((g) => g.key === k)?.label ?? k}
        />
        <FilterSection
          title="Equipment"
          options={facetValues.equipment}
          selected={facets.equipment}
          onToggle={(v) => onToggle('equipment', v)}
          labelOf={prettify}
        />
        <FilterSection
          title="Mechanic"
          options={facetValues.mechanic}
          selected={facets.mechanic}
          onToggle={(v) => onToggle('mechanic', v)}
          labelOf={prettify}
        />
        <FilterSection
          title="Level"
          options={facetValues.level}
          selected={facets.level}
          onToggle={(v) => onToggle('level', v)}
          labelOf={prettify}
        />
        <FilterSection
          title="Category"
          options={facetValues.category}
          selected={facets.category}
          onToggle={(v) => onToggle('category', v)}
          labelOf={prettify}
        />

        <button
          onClick={onClose}
          className="mt-1 h-12 w-full rounded-[var(--r-md)] text-[14px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Show {resultCount} {resultCount === 1 ? 'exercise' : 'exercises'}
        </button>
      </div>
    </div>
  );
}

export function LibraryScreen() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const index = useSearchIndex();
  const [query, setQuery] = useState('');
  const [facets, setFacets] = useState<FacetState>(emptyFacets);
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeCount =
    facets.muscles.size +
    facets.equipment.size +
    facets.mechanic.size +
    facets.level.size +
    facets.category.size;

  function toggle(group: FacetGroup, value: string) {
    setFacets((prev) => {
      const next = new Set(prev[group]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [group]: next };
    });
  }

  /** Distinct facet values present in the catalog (so chips never show dead options). */
  const facetValues = useMemo(() => {
    const equipment = new Set<string>();
    const mechanic = new Set<string>();
    const level = new Set<string>();
    const category = new Set<string>();
    for (const ex of catalog ?? []) {
      if (ex.equipment) equipment.add(ex.equipment);
      if (ex.mechanic) mechanic.add(ex.mechanic);
      if (ex.level) level.add(ex.level);
      if (ex.category) category.add(ex.category);
    }
    const sorted = (s: Set<string>) => [...s].sort();
    return {
      equipment: sorted(equipment),
      mechanic: sorted(mechanic),
      level: sorted(level),
      category: sorted(category),
    };
  }, [catalog]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim();
    let base: Exercise[];
    if (!q) {
      base = catalog;
    } else if (index) {
      base = searchIds(index, q, 100)
        .map((id) => getCatalogExercise(id))
        .filter((e): e is Exercise => Boolean(e));
    } else {
      // Index still loading — fall back to the name substring filter.
      base = searchCatalog(catalog, q, catalog.length);
    }

    const selMuscles = new Set<Muscle>();
    for (const key of facets.muscles) {
      MUSCLE_GROUPS.find((g) => g.key === key)?.muscles.forEach((m) => selMuscles.add(m));
    }

    return base.filter((ex) => {
      if (
        selMuscles.size &&
        ![...ex.primaryMuscles, ...ex.secondaryMuscles].some((m) => selMuscles.has(m))
      )
        return false;
      if (facets.equipment.size && !(ex.equipment && facets.equipment.has(ex.equipment))) return false;
      if (facets.mechanic.size && !(ex.mechanic && facets.mechanic.has(ex.mechanic))) return false;
      if (facets.level.size && !(ex.level && facets.level.has(ex.level))) return false;
      if (facets.category.size && !(ex.category && facets.category.has(ex.category))) return false;
      return true;
    });
  }, [catalog, index, query, facets]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="px-[22px] pb-1.5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="text-[30px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-tight)' }}>
            Library
          </div>
          <span className="rounded-[var(--r-md)] bg-surface px-3.5 py-2 text-[13px] font-semibold text-faint">
            {catalog ? `${results.length} exercises` : '…'}
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
            placeholder="Search exercises or muscles"
            className="h-full flex-1 bg-transparent text-[14px] text-text placeholder:text-faint focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-faint">
              <CloseIcon className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="os-scroll flex flex-none gap-2 overflow-x-auto px-[22px] pb-1.5 pt-2">
        <button
          onClick={() => setSheetOpen(true)}
          className="flex flex-none items-center gap-1.5 rounded-[var(--r-pill)] px-[13px] py-[7px] text-[12px] font-semibold"
          style={
            activeCount > 0
              ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
              : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border-card)' }
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filters{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
        {MUSCLE_GROUPS.map((g) => (
          <Chip
            key={g.key}
            label={g.label}
            active={facets.muscles.has(g.key)}
            onClick={() => toggle('muscles', g.key)}
          />
        ))}
      </div>

      {catalog === null ? (
        <p className="p-6 text-center text-[13px] text-muted">Loading library…</p>
      ) : results.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-muted">No matches.</p>
      ) : (
        <Virtuoso
          className="os-scroll min-h-0 flex-1"
          data={results}
          components={{
            Header: () => <div className="h-1.5" />,
            Footer: () => <div className="h-24" />,
          }}
          itemContent={(_, ex) => (
            <div className="px-[22px] pb-2">
              <ExerciseRow ex={ex} onOpen={() => navigate(`/library/${encodeURIComponent(ex.id)}`)} />
            </div>
          )}
        />
      )}

      {sheetOpen && (
        <FilterSheet
          facets={facets}
          facetValues={facetValues}
          onToggle={toggle}
          onClear={() => setFacets(emptyFacets())}
          onClose={() => setSheetOpen(false)}
          resultCount={results.length}
        />
      )}
    </div>
  );
}
