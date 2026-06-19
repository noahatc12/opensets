import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { DumbbellIcon } from '../../components/icons';
import { t } from '../../i18n/strings';

export function TodayScreen() {
  return (
    <Screen title={t.today.title}>
      <EmptyState
        icon={<DumbbellIcon />}
        title={t.today.emptyTitle}
        body={t.today.emptyBody}
      />
      <p className="mt-2 text-center text-[12px] text-faint">
        {t.today.disclaimer}
      </p>
    </Screen>
  );
}
