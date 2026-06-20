import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen, Section } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DumbbellIcon } from '../../components/icons';
import { t } from '../../i18n/strings';
import { useSessionStore } from '../../state/session';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import {
  getActiveProgram,
  listTemplates,
  startSessionFromTemplate,
  getActiveWorkoutSession,
} from '../../db/repositories';
import { ActiveSession } from './ActiveSession';

const nowIso = () => new Date().toISOString();
const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

export function TodayScreen() {
  useCatalog();
  const navigate = useNavigate();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const beginSession = useSessionStore((s) => s.beginSession);

  const activeProgram = useLiveQuery(() => getActiveProgram());
  const templates = useLiveQuery(
    () =>
      activeProgram ? listTemplates(activeProgram.id) : Promise.resolve([]),
    [activeProgram?.id],
  );

  // Resume an in-progress workout after a reload (basic crash recovery).
  useEffect(() => {
    if (activeSessionId) return;
    void getActiveWorkoutSession().then((s) => {
      if (s) beginSession(s.id);
    });
  }, [activeSessionId, beginSession]);

  if (activeSessionId) {
    return <ActiveSession />;
  }

  const tpl = templates?.[0];
  const ready = tpl && tpl.slots.length > 0;

  if (!ready) {
    return (
      <Screen title={t.today.title}>
        <EmptyState
          icon={<DumbbellIcon />}
          title="Build your first routine"
          body="Add your exercises, set your starting weights, and OpenSets will tell you what to lift — and when to add weight."
          action={
            <Button onClick={() => navigate('/routine/new')}>
              Build a routine
            </Button>
          }
        />
        <p className="mt-2 text-center text-[12px] text-faint">
          {t.today.disclaimer}
        </p>
      </Screen>
    );
  }

  async function start() {
    if (!tpl) return;
    const s = await startSessionFromTemplate(tpl, nowIso());
    beginSession(s.id);
  }

  return (
    <Screen title={t.today.title}>
      <Section title={activeProgram?.name ?? 'Routine'}>
        <Card className="flex flex-col gap-3">
          <div>
            <div className="text-[15px] font-semibold text-text">
              {tpl.name}
            </div>
            <div className="text-[13px] text-muted">
              {tpl.slots.length} exercises
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {tpl.slots.map((slot) => (
              <li
                key={slot.slotId}
                className="flex justify-between text-[14px] text-muted"
              >
                <span className="truncate text-text">
                  {nameOf(slot.exerciseId)}
                </span>
                <span className="tnum shrink-0 pl-3 text-faint">
                  {slot.scheme.sets} ×{' '}
                  {slot.scheme.repRange
                    ? `${slot.scheme.repRange[0]}–${slot.scheme.repRange[1]}`
                    : slot.scheme.repTarget}
                </span>
              </li>
            ))}
          </ul>
          <Button block onClick={() => void start()}>
            Start workout
          </Button>
        </Card>
      </Section>

      <button
        type="button"
        onClick={() => navigate('/routine/new')}
        className="mx-auto block text-[13px] text-muted underline-offset-2 hover:underline"
      >
        Build another routine
      </button>
      <p className="mt-6 text-center text-[12px] text-faint">
        {t.today.disclaimer}
      </p>
    </Screen>
  );
}
