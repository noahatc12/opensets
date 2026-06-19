import { Screen } from '../../components/Screen';
import { EmptyState } from '../../components/EmptyState';
import { LibraryIcon } from '../../components/icons';
import { t } from '../../i18n/strings';

export function LibraryScreen() {
  return (
    <Screen title={t.library.title}>
      <EmptyState
        icon={<LibraryIcon />}
        title={t.library.emptyTitle}
        body={t.library.emptyBody}
      />
    </Screen>
  );
}
