import { useEffect, useState, useSyncExternalStore } from 'react';
import { Sheet, SheetHeader } from './Sheet';
import { useNav } from './nav';
import { viewportReadout } from './viewport';
import {
  backFeel,
  getFeel,
  isTuning,
  resetFeel,
  setFeel,
  setTuning,
  sheetFeel,
  subscribeFeel,
  type Gesture,
  type SpringParams,
  type Speed,
  type Trigger,
} from '../lib/feel';

/* The feel tuning panel: a device-QA tool, not a setting. It shows only in tune mode
   (`?tune` in the URL, or five taps on the version line in Settings, since the Home
   Screen app has no address bar). Pick a speed and a trigger for each gesture, press Try
   it, and the panel steps aside so the gesture can be felt; the pill brings it back. The
   choice is stored on the device and read on the next swipe. */

const SPEEDS: [Speed, string][] = [
  ['snappy', 'Snappy'],
  ['now', 'Now'],
  ['soft', 'Soft'],
];
const TRIGGERS: [Trigger, string][] = [
  ['easy', 'Easy'],
  ['now', 'Now'],
  ['firm', 'Firm'],
];

const pair = (p: SpringParams) =>
  `${Math.round(p.stiffness)}/${Math.round(p.damping)}`;

export function FeelPanel() {
  const choice = useSyncExternalStore(subscribeFeel, getFeel);
  const tuning = useSyncExternalStore(subscribeFeel, isTuning);
  const [open, setOpen] = useState(true);
  const [demo, setDemo] = useState(false);
  const nav = useNav();
  if (!tuning) return null;

  const back = backFeel(choice);
  const sheet = sheetFeel(choice);

  return (
    <>
      {!open && !demo && (
        <button
          type="button"
          className="os-feel-pill os-press"
          onClick={() => setOpen(true)}
        >
          Feel
        </button>
      )}
      {open && (
        <div className="os-feel os-card" role="region" aria-label="Feel tuning">
          <div className="flex items-center justify-between">
            <span
              className="text-[17px] font-extrabold"
              style={{ letterSpacing: '-.02em' }}
            >
              Tune the feel
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-2 text-[14px] font-bold"
              style={{ color: 'var(--acc-tx)' }}
            >
              Hide
            </button>
          </div>

          <Group
            gesture="back"
            title="Swipe back"
            hint="From the left edge of an inner screen."
            numbers={`Goes back past ${Math.round(back.closeFraction * 100)}% of the width or a ${back.flick.toFixed(2)} px/ms flick. Springs ${pair(back.release)} out, ${pair(back.home)} home.`}
            onTry={() => {
              setOpen(false);
              nav.push('/plates');
            }}
          />
          <Group
            gesture="sheet"
            title="Sheets"
            hint="Pull down and let go, or flick."
            numbers={`Closes past ${Math.round(sheet.closeFraction * 100)}% of its height or a ${sheet.flick.toFixed(2)} px/ms flick. Springs ${pair(sheet.close)} out, ${pair(sheet.home)} home, ${pair(sheet.flickHome)} after a flick.`}
            onTry={() => {
              setOpen(false);
              setDemo(true);
            }}
          />
          <ScreenReadout />

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={resetFeel}
              className="h-10 px-1 text-[14px] font-bold"
              style={{ color: 'var(--acc-tx)' }}
            >
              Back to shipped
            </button>
            <button
              type="button"
              onClick={() => setTuning(false)}
              className="h-10 px-1 text-[14px] font-bold"
              style={{ color: 'var(--mute)' }}
            >
              Turn off
            </button>
          </div>
        </div>
      )}

      <Sheet
        open={demo}
        label="Practice sheet"
        height="62%"
        onClose={() => {
          setDemo(false);
          setOpen(true);
        }}
      >
        <SheetHeader
          title="Practice sheet"
          action="Done"
          onAction={() => {
            setDemo(false);
            setOpen(true);
          }}
        />
        <p className="os-t mt-1 leading-[1.4]">
          Pull it down slowly and let go, then try a short flick. The list
          scrolls first when it is not at the top.
        </p>
        <div className="mt-3 min-h-0 flex-1 overflow-auto">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="os-row">
              <span className="text-[15px] font-semibold">Row {i + 1}</span>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** The viewport numbers, for the bottom gap on the Home Screen app where `?probe` cannot
 *  be typed. Measured on open, on resize, and on Measure. */
function ScreenReadout() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    const measure = () => setLines(viewportReadout());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[15px] font-bold">Screen</div>
          <div className="os-t mt-0.5">Screenshot this on a tab screen.</div>
        </div>
        <button
          type="button"
          onClick={() => setLines(viewportReadout())}
          className="os-chip os-chip--acc os-press flex-none"
        >
          Measure
        </button>
      </div>
      <pre className="os-feel-numbers mt-2 whitespace-pre-wrap">
        {lines.join('\n')}
      </pre>
    </div>
  );
}

function Group({
  gesture,
  title,
  hint,
  numbers,
  onTry,
}: {
  gesture: Gesture;
  title: string;
  hint: string;
  numbers: string;
  onTry: () => void;
}) {
  const choice = useSyncExternalStore(subscribeFeel, getFeel)[gesture];
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[15px] font-bold">{title}</div>
          <div className="os-t mt-0.5">{hint}</div>
        </div>
        <button
          type="button"
          onClick={onTry}
          className="os-chip os-chip--acc os-press flex-none"
        >
          Try it
        </button>
      </div>
      <Seg
        label="Speed"
        group={title}
        options={SPEEDS}
        value={choice.speed}
        onPick={(speed) => setFeel(gesture, { speed })}
      />
      <Seg
        label="Trigger"
        group={title}
        options={TRIGGERS}
        value={choice.trigger}
        onPick={(trigger) => setFeel(gesture, { trigger })}
      />
      <p className="os-feel-numbers mt-2">{numbers}</p>
    </div>
  );
}

function Seg<T extends string>({
  label,
  group,
  options,
  value,
  onPick,
}: {
  label: string;
  group: string;
  options: [T, string][];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="os-t w-[52px] flex-none">{label}</span>
      <div
        className="os-seg flex-1"
        role="radiogroup"
        aria-label={`${group} ${label.toLowerCase()}`}
      >
        {options.map(([v, name]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onPick(v)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
