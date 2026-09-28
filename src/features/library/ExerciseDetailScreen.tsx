import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNav } from '../../ui/nav';
import { Pushed } from '../../ui/Pushed';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useCatalog } from './useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm, isE1rmEligible } from '../../engine';
import { useSettings } from '../../db/hooks';
import { toUnit, roundDisplay, fmtWeight } from '../../lib/units';
import { dateShort, titleCase } from '../../lib/format';
import { BackButton, StatTiles, SectionHead } from '../../ui/StatGrid';
import { TrendChart, type TrendPoint } from '../../ui/TrendChart';
import type { LoggedSet } from '../../db/types';

/* Exercise detail: eyebrow and title, three tiles, the e1RM trend, how to, history per
   session, and one way to put the exercise into a day. */

function Slide({ src, label }: { src?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={label}
        onError={() => setFailed(true)}
        className="aspect-[4/3] w-full object-cover"
        style={{ background: 'var(--s1)' }}
      />
    );
  }
  return (
    <div
      className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5"
      style={{ background: 'var(--s1)', color: 'var(--mute)' }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path
          d="M5 17l4.5-4 3 2.5L17 11l2 2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="os-t text-[11px]">{label}</span>
    </div>
  );
}

/* Swipeable image gallery: horizontal scroll-snap so swiping through the photos never
   scrolls the page. Exercise photos come as [start, end]. */
function ImageCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const labels = ['Start', 'End'];
  function onScroll() {
    const el = ref.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }
  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto rounded-[18px]"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          boxShadow: 'inset 0 1px 0 var(--hl)',
        }}
      >
        {images.map((src, i) => (
          <div
            key={i}
            className="w-full flex-none"
            style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always' }}
          >
            <Slide src={src} label={labels[i] ?? `${i + 1}`} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
          {images.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: i === active ? 18 : 6,
                background: i === active ? 'var(--acc)' : 'var(--s3)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExerciseDetailScreen() {
  const catalog = useCatalog();
  const nav = useNav();
  const { units } = useSettings();
  const { id = '' } = useParams();
  const ex = catalog ? getCatalogExercise(decodeURIComponent(id)) : undefined;

  const sets = useLiveQuery(
    () =>
      ex
        ? db.sets.where('exerciseId').equals(ex.id).toArray()
        : Promise.resolve<LoggedSet[]>([]),
    [ex?.id],
  );
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const templates = useLiveQuery(() => db.templates.toArray());

  const live = useMemo(
    () => (sets ?? []).filter((s) => !s.deletedAt && s.completed),
    [sets],
  );

  // Per-session history, newest first, with the best e1RM of the session.
  const history = useMemo(() => {
    const bySession = new Map<string, LoggedSet[]>();
    for (const s of live) {
      const arr = bySession.get(s.sessionId) ?? [];
      arr.push(s);
      bySession.set(s.sessionId, arr);
    }
    const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));
    const tplName = new Map((templates ?? []).map((t) => [t.id, t.name]));
    return [...bySession.entries()]
      .map(([sid, arr]) => {
        const sorted = arr.slice().sort((a, b) => a.order - b.order);
        const sess = sessionById.get(sid);
        const eligible = sorted.filter((s) => isE1rmEligible(s));
        const bestE1rm = eligible.length
          ? Math.max(...eligible.map((s) => e1rm(s.weightLb, s.reps)))
          : null;
        return {
          id: sid,
          date: sess?.startedAt ?? sorted[0]!.date,
          day: sess?.templateId ? tplName.get(sess.templateId) : undefined,
          sets: sorted,
          bestE1rm,
          pr: sorted.some((s) => s.isPR?.length),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [live, sessions, templates]);

  const trend = useMemo<TrendPoint[]>(
    () =>
      history
        .slice()
        .reverse()
        .filter((h) => h.bestE1rm !== null)
        .map((h) => ({ date: h.date, value: h.bestE1rm!, isPR: h.pr })),
    [history],
  );

  if (catalog === null) return <p className="os-t p-8 text-center">Loading…</p>;
  if (!ex) {
    return (
      <div className="px-[18px] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackButton onClick={() => nav.pop('/library')} />
        <div className="os-card mt-4 text-center">
          <div className="text-[15px] font-extrabold">Exercise not found</div>
          <p className="os-t mt-1">
            It may have been removed from the library.
          </p>
        </div>
      </div>
    );
  }

  const best = trend.length ? Math.max(...trend.map((p) => p.value)) : null;
  const lastTop = history[0]?.sets
    .slice()
    .sort((a, b) => b.weightLb * b.reps - a.weightLb * a.reps)[0];
  const first = trend[0]?.value;
  const last = trend[trend.length - 1]?.value;
  const delta =
    first !== undefined && last !== undefined && trend.length >= 2
      ? last - first
      : null;
  const weeks =
    trend.length >= 2
      ? Math.max(
          1,
          Math.round(
            (Date.parse(trend[trend.length - 1]!.date) -
              Date.parse(trend[0]!.date)) /
              (7 * 86_400_000),
          ),
        )
      : 0;
  const eyebrow = [
    titleCase(ex.primaryMuscles[0]),
    titleCase(ex.equipment),
    ex.mechanic,
  ]
    .filter(Boolean)
    .join(' · ');
  const wr = (s: LoggedSet) =>
    `${s.weightLb > 0 ? fmtWeight(s.weightLb, units) : 'BW'}×${s.reps}`;

  return (
    <Pushed to={'/library'}>
      <div className="relative h-full overflow-auto px-[18px] pb-[120px] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackButton onClick={() => nav.pop()} />
        <div className="os-t mt-3.5" style={{ color: 'var(--acc-tx)' }}>
          {eyebrow}
        </div>
        <h1 className="os-h1 mt-0.5">{ex.name}</h1>

        {ex.images.length > 0 && (
          <div className="mt-3.5">
            <ImageCarousel images={ex.images} />
          </div>
        )}

        <div className="mt-3.5">
          <StatTiles
            cols={3}
            size={24}
            stats={[
              {
                label: 'Best e1RM',
                value:
                  best !== null
                    ? roundDisplay(toUnit(best, units), units)
                    : 'none',
                color: best !== null ? 'var(--pr)' : 'var(--mute)',
              },
              {
                label: 'Last top set',
                value: lastTop
                  ? `${lastTop.weightLb > 0 ? fmtWeight(lastTop.weightLb, units) : 'BW'}×${lastTop.reps}`
                  : 'none',
                color: lastTop ? undefined : 'var(--mute)',
              },
              { label: 'Sessions', value: history.length },
            ]}
          />
        </div>

        <div className="os-card mt-3">
          <div className="flex justify-between">
            <span className="os-t">e1RM trend</span>
            {delta !== null ? (
              <span
                className="os-t"
                style={{ color: delta >= 0 ? 'var(--pos)' : 'var(--danger)' }}
              >
                {delta >= 0 ? '+' : ''}
                {roundDisplay(toUnit(delta, units), units)} in {weeks} wk
              </span>
            ) : (
              <span className="os-t">
                {trend.length === 1 ? 'one session so far' : 'no sessions yet'}
              </span>
            )}
          </div>
          {trend.length >= 2 ? (
            <div className="mt-2">
              <TrendChart points={trend} />
            </div>
          ) : (
            <p className="os-t mt-2 leading-snug">
              Log this lift in two sessions and the trend draws here.
            </p>
          )}
        </div>

        {ex.instructions.length > 0 && (
          <>
            <SectionHead>How to</SectionHead>
            <div className="os-card">
              {ex.instructions.map((step, i) => (
                <p
                  key={i}
                  className={`text-[14px] leading-[1.5] ${i > 0 ? 'mt-2' : ''}`}
                  style={{ color: 'var(--ink2)' }}
                >
                  {step}
                </p>
              ))}
            </div>
          </>
        )}

        <SectionHead right={history.length || undefined}>History</SectionHead>
        {history.length === 0 ? (
          <div className="os-card">
            <div className="text-[15px] font-extrabold">Not logged yet</div>
            <p className="os-t mt-1">
              Add it to a day and your sets will show here.
            </p>
          </div>
        ) : (
          <div className="os-card" style={{ padding: '4px 16px' }}>
            {history.slice(0, 20).map((h) => (
              <div key={h.id} className="os-row">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {dateShort(h.date)}
                    {h.day ? ` · ${h.day}` : ''}
                  </span>
                  <span
                    className="mt-0.5 block truncate text-[12px] font-medium"
                    style={{
                      color: 'var(--mute)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {h.sets.map(wr).join(' · ')}
                  </span>
                </span>
                {h.bestE1rm !== null && (
                  <span
                    className="os-num text-[17px]"
                    style={{
                      letterSpacing: '-.02em',
                      color: h.pr ? 'var(--pr)' : 'var(--ink)',
                    }}
                  >
                    {roundDisplay(toUnit(h.bestE1rm, units), units)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="os-dock">
          <button
            type="button"
            onClick={() =>
              nav.push('/routine/new', { state: { addExerciseId: ex.id } })
            }
            className="os-btn os-btn--ink os-press"
          >
            Add to a day
          </button>
        </div>
      </div>
    </Pushed>
  );
}
