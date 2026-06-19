import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { HistoryIcon } from '../../components/icons';
import { t } from '../../i18n/strings';

export function HistoryScreen() {
  return (
    <Screen title={t.history.title}>
      <EmptyState
        icon={<HistoryIcon />}
        title={t.history.emptyTitle}
        body={t.history.emptyBody}
      />
    </Screen>
  );
}
