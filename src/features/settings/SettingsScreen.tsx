import { useRef, useState } from 'react';
import { Screen, Section } from '../../components/Screen';
import { Card, CardRow } from '../../components/Card';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Segmented';
import { DownloadIcon, UploadIcon, ShieldIcon } from '../../components/icons';
import { t } from '../../i18n/strings';
import { useSettings, updateSettings } from '../../db/hooks';
import {
  downloadEnvelope,
  importFromJson,
  ImportError,
} from '../../db/exportImport';
import { usePersistentStorage } from './usePersistentStorage';

function formatBytes(n: number | null): string {
  if (n === null) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

type Feedback = { kind: 'ok' | 'err'; msg: string } | null;

export function SettingsScreen() {
  const settings = useSettings();
  const storage = usePersistentStorage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setFeedback(null);
    try {
      await downloadEnvelope(new Date().toISOString());
      await updateSettings({ lastExportAt: new Date().toISOString() });
      setFeedback({ kind: 'ok', msg: 'Backup downloaded.' });
    } catch {
      setFeedback({ kind: 'err', msg: 'Export failed.' });
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true);
    setFeedback(null);
    try {
      const text = await file.text();
      await importFromJson(text);
      await storage.refresh();
      setFeedback({ kind: 'ok', msg: 'Backup restored.' });
    } catch (err) {
      const msg =
        err instanceof ImportError ? err.message : 'Could not read that file.';
      setFeedback({ kind: 'err', msg });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const persistedLabel =
    storage.persisted === true
      ? t.settings.storagePersisted
      : storage.persisted === false
        ? t.settings.storageBestEffort
        : 'Checking…';

  return (
    <Screen title={t.settings.title}>
      <Section title={t.settings.units}>
        <Card>
          <CardRow label={t.settings.units} hint={t.settings.unitsHint}>
            <Segmented
              ariaLabel={t.settings.units}
              value={settings.units}
              onChange={(units) => void updateSettings({ units })}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </CardRow>
        </Card>
      </Section>

      <Section title={t.settings.storage}>
        <Card>
          <div className="flex items-start gap-3">
            <div
              className={
                storage.persisted ? 'mt-0.5 text-success' : 'mt-0.5 text-warn'
              }
            >
              <ShieldIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug text-text">
                {persistedLabel}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {t.settings.usage}: {formatBytes(storage.usageBytes)}
                {storage.quotaBytes
                  ? ` of ${formatBytes(storage.quotaBytes)}`
                  : ''}
              </p>
            </div>
          </div>
          {storage.persisted !== true && storage.supported && (
            <Button
              variant="secondary"
              block
              className="mt-3"
              onClick={() => void storage.request()}
            >
              {t.settings.requestPersist}
            </Button>
          )}
        </Card>
      </Section>

      <Section title={t.settings.data}>
        <Card className="flex flex-col gap-3">
          <CardRow label={t.settings.export} hint={t.settings.exportHint} />
          <Button
            block
            leadingIcon={<DownloadIcon className="size-[18px]" />}
            onClick={() => void handleExport()}
          >
            {t.settings.export}
          </Button>

          <div className="my-1 border-t border-border" />

          <CardRow label={t.settings.import} hint={t.settings.importHint} />
          <Button
            block
            variant="secondary"
            disabled={busy}
            leadingIcon={<UploadIcon className="size-[18px]" />}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Restoring…' : t.settings.import}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />

          {feedback && (
            <p
              role="status"
              className={
                feedback.kind === 'ok'
                  ? 'text-[13px] text-success'
                  : 'text-[13px] text-danger'
              }
            >
              {feedback.msg}
            </p>
          )}
        </Card>
      </Section>

      <Section title={t.settings.about}>
        <Card className="space-y-2">
          <p className="text-[13px] leading-relaxed text-muted">
            {t.settings.privacy}
          </p>
          <p className="text-[13px] leading-relaxed text-faint">
            {t.settings.disclaimer}
          </p>
          <p className="pt-1 text-[12px] text-faint">
            Exercise data: free-exercise-db (Unlicense). OpenSets is
            MIT-licensed.
          </p>
        </Card>
      </Section>
    </Screen>
  );
}
