import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';
import { CloseIcon } from './icons';

/**
 * In-app "update ready — reload" toast (spec §9). With registerType:'autoUpdate'
 * the new service worker activates on next launch; this surfaces it immediately so
 * a long-lived session can opt to reload now.
 */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(5rem,calc(env(safe-area-inset-bottom)+5rem))] z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border-strong bg-elevated px-4 py-3 shadow-lg">
        <span className="text-[14px] text-text">A new version is ready.</span>
        <Button
          variant="primary"
          className="min-h-9 px-3 text-[13px]"
          onClick={() => void updateServiceWorker(true)}
        >
          Reload
        </Button>
        <button
          type="button"
          aria-label="Dismiss"
          className="text-faint hover:text-muted"
          onClick={() => setNeedRefresh(false)}
        >
          <CloseIcon className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}
