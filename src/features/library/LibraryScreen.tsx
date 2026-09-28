import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNav } from '../../ui/nav';
import { Virtuoso } from 'react-virtuoso';
import { useCatalog } from './useCatalog';
import { useBestE1rm } from './useBestE1rm';
import { MUSCLE_GROUPS } from './muscleGroups';
import { getCatalogExercise } from '../../db/catalog';
import { searchExercises } from '../../db/exerciseSearch';
import { useSettings } from '../../db/hooks';
import { roundDisplay, toUnit } from '../../lib/units';
import { titleCase } from '../../lib/format';
import { ScreenTitle, SectionHead } from '../../ui/StatGrid';
import { Sheet, SheetHeader } from '../../ui/Sheet';
import type { Exercise, Muscle } from '../../db/types';
import { useScrollMemory } from '../../ui/scrollMemory';

/* Library (spec §7): index-backed search with a synonym layer, muscle chips and a filter
   sheet, the lifter's own lifts first with their best e1RM, then the whole catalog
   virtualized over the page scroller. */

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

function Thumb({ ex }: { ex: Exercise }) {
  const [failed, setFailed] = useState(false);
  const src = ex.images[0];
  const box = {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(160deg, var(--s3), var(--s2))',
    boxShadow: 'inset 0 1px 0 var(--hl2)',
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`os-chip os-press ${active ? 'os-chip--on' : ''}`}
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
    <div className="mb-3.5">
      <div className="os-t mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip
            key={o}
            label={labelOf(o)}
            active={selected.has(o)}
            onClick={() => onToggle(o)}
          />
        ))}
      </div>
    </div>
  );
}

/** The virtualized list draws its rows into a card. */
const ListCard = forwardRef<
  HTMLDivElement,
  { style?: React.CSSProperties; children?: ReactNode }
>(function ListCard({ style, children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest} style={style} className="os-card" data-list-card>
      {children}
    </div>
  );
});

/** The search and filters outlive the screen, so opening an exercise and coming back
 *  lands on the same results at the same place (scroll: ui/scrollMemory.ts). */
const kept: { query: string; facets: FacetState } = {
  query: '',
  facets: emptyFacets(),
};

export function LibraryScreen() {
  const nav = useNav();
  const catalog = useCatalog();
  const { units } = useSettings();
  const { best, sessions } = useBestE1rm();
  const [query, setQuery] = useState(kept.query);
  const [facets, setFacets] = useState<FacetState>(kept.facets);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scroller, setScroller] = useScrollMemory('library');
  useEffect(() => {
    kept.query = query;
    kept.facets = facets;
  }, [query, facets]);

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

  // Search by name, alias, muscle and equipment (db/exerciseSearch.ts); an alias hit is
  // shown on the row so "pec fly" landing on Butterfly explains itself.
  const hits = useMemo(
    () =>
      catalog && query.trim()
        ? searchExercises(catalog, query, { limit: 100 })
        : null,
    [catalog, query],
  );
  const aliasOf = useMemo(
    () =>
      new Map(
        (hits ?? []).flatMap((h) =>
          h.matchedAlias ? [[h.id, h.matchedAlias] as const] : [],
        ),
      ),
    [hits],
  );

  const results = useMemo(() => {
    if (!catalog) return [];
    const base: Exercise[] = hits
      ? hits
          .map((h) => getCatalogExercise(h.id))
          .filter((e): e is Exercise => Boolean(e))
      : catalog;

    const selMuscles = new Set<Muscle>();
    for (const key of facets.muscles)
      MUSCLE_GROUPS.find((g) => g.key === key)?.muscles.forEach((m) =>
        selMuscles.add(m),
      );

    return base.filter((ex) => {
      if (
        selMuscles.size &&
        ![...ex.primaryMuscles, ...ex.secondaryMuscles].some((m) =>
          selMuscles.has(m),
        )
      )
        return false;
      if (
        facets.equipment.size &&
        !(ex.equipment && facets.equipment.has(ex.equipment))
      )
        return false;
      if (
        facets.mechanic.size &&
        !(ex.mechanic && facets.mechanic.has(ex.mechanic))
      )
        return false;
      if (facets.level.size && !(ex.level && facets.level.has(ex.level)))
        return false;
      if (
        facets.category.size &&
        !(ex.category && facets.category.has(ex.category))
      )
        return false;
      return true;
    });
  }, [catalog, hits, facets]);

  // The lifter's own exercises, best e1RM first, within the same search and filters.
  const yours = useMemo(
    () =>
      results
        .filter((e) => sessions.has(e.id))
        .sort((a, b) => (best.get(b.id) ?? 0) - (best.get(a.id) ?? 0)),
    [results, sessions, best],
  );
  const topE1rm = yours.length ? (best.get(yours[0]!.id) ?? 0) : 0;

  const open = (ex: Exercise) =>
    nav.push(`/library/${encodeURIComponent(ex.id)}`);
  const meta = (ex: Exercise) =>
    [
      aliasOf.has(ex.id) ? `matches “${aliasOf.get(ex.id)}”` : null,
      titleCase(ex.primaryMuscles[0]),
      titleCase(ex.equipment),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="relative flex h-full flex-col">
      <div
        ref={setScroller}
        className="min-h-0 flex-1 overflow-auto px-[18px] pb-[120px] pt-2"
      >
        <ScreenTitle
          eyebrow={
            catalog ? `${catalog.length} exercises` : 'Loading the library'
          }
          title="Library"
        />

        <div className="os-search mt-3.5">
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search exercises or muscles"
            className="os-input text-[15px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="os-t px-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="os-chips mt-2.5">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`os-chip os-press ${activeCount > 0 ? 'os-chip--acc' : ''}`}
            aria-label={
              activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden
            >
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
          <p className="os-t mt-8 text-center">Loading library…</p>
        ) : results.length === 0 ? (
          <div className="os-card mt-4 text-center">
            <div className="text-[15px] font-extrabold">
              No exercise matches
            </div>
            <p className="os-t mt-1">Try another word, or clear the filters.</p>
            {(query || activeCount > 0) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFacets(emptyFacets());
                }}
                className="os-btn os-btn--sm os-press mt-3"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <>
            {yours.length > 0 && (
              <>
                <SectionHead right={yours.length}>Your lifts</SectionHead>
                <div className="os-card" style={{ padding: '4px 16px' }}>
                  {yours.slice(0, 8).map((ex) => {
                    const b = best.get(ex.id);
                    const n = sessions.get(ex.id) ?? 0;
                    return (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => open(ex)}
                        className="os-row os-press"
                        aria-label={`${ex.name}, e1RM ${b ? roundDisplay(toUnit(b, units), units) : 'none'}`}
                      >
                        <Thumb ex={ex} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">
                            {ex.name}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-[12px] font-medium"
                            style={{ color: 'var(--mute)' }}
                          >
                            {meta(ex)} · {n} {n === 1 ? 'session' : 'sessions'}
                          </span>
                        </span>
                        {b ? (
                          <span className="text-right">
                            <span
                              className="os-num block text-[17px]"
                              style={{
                                letterSpacing: '-.02em',
                                color:
                                  b === topE1rm ? 'var(--pr)' : 'var(--ink)',
                              }}
                            >
                              {roundDisplay(toUnit(b, units), units)}
                            </span>
                            <span className="os-t block text-[11px]">
                              e1RM {units}
                            </span>
                          </span>
                        ) : (
                          <span className="os-t">logged</span>
                        )}
                        <span className="os-chev" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <SectionHead
              right={query || activeCount ? results.length : undefined}
            >
              {query || activeCount ? 'Matches' : 'All exercises'}
            </SectionHead>
            {scroller && (
              <Virtuoso
                customScrollParent={scroller}
                data={results}
                components={{ List: ListCard }}
                itemContent={(_, ex) => (
                  <div style={{ padding: '0 16px' }}>
                    <button
                      type="button"
                      onClick={() => open(ex)}
                      className="os-row os-press"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {ex.name}
                        </span>
                        <span
                          className="mt-0.5 block truncate text-[12px] font-medium"
                          style={{ color: 'var(--mute)' }}
                        >
                          {meta(ex)}
                        </span>
                      </span>
                      <span className="os-chev" />
                    </button>
                  </div>
                )}
              />
            )}
          </>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        label="Filters"
      >
        <SheetHeader
          title="Filters"
          action="Clear all"
          onAction={() => setFacets(emptyFacets())}
        />
        <div className="mt-3 min-h-0 overflow-auto">
          <FilterSection
            title="Muscle group"
            options={MUSCLE_GROUPS.map((g) => g.key)}
            selected={facets.muscles}
            onToggle={(v) => toggle('muscles', v)}
            labelOf={(k) => MUSCLE_GROUPS.find((g) => g.key === k)?.label ?? k}
          />
          <FilterSection
            title="Equipment"
            options={facetValues.equipment}
            selected={facets.equipment}
            onToggle={(v) => toggle('equipment', v)}
            labelOf={titleCase}
          />
          <FilterSection
            title="Mechanic"
            options={facetValues.mechanic}
            selected={facets.mechanic}
            onToggle={(v) => toggle('mechanic', v)}
            labelOf={titleCase}
          />
          <FilterSection
            title="Level"
            options={facetValues.level}
            selected={facets.level}
            onToggle={(v) => toggle('level', v)}
            labelOf={titleCase}
          />
          <FilterSection
            title="Category"
            options={facetValues.category}
            selected={facets.category}
            onToggle={(v) => toggle('category', v)}
            labelOf={titleCase}
          />
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          className="os-btn os-btn--pri os-press mt-1 flex-none"
        >
          Show {results.length}{' '}
          {results.length === 1 ? 'exercise' : 'exercises'}
        </button>
      </Sheet>
    </div>
  );
}
