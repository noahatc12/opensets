import { useCallback, useEffect, useState } from 'react';

export interface StorageStatus {
  /** null while unknown / unsupported. */
  persisted: boolean | null;
  usageBytes: number | null;
  quotaBytes: number | null;
  supported: boolean;
}

/**
 * Storage durability (spec §9): request `navigator.storage.persist()` and surface
 * persisted state + usage/quota. The actual eviction protection is the user's to
 * grant; this exposes the truth so Settings can nudge.
 */
export function usePersistentStorage() {
  const supported = typeof navigator !== 'undefined' && 'storage' in navigator;
  const [status, setStatus] = useState<StorageStatus>({
    persisted: null,
    usageBytes: null,
    quotaBytes: null,
    supported,
  });

  const refresh = useCallback(async () => {
    if (!supported) return;
    const persisted = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : null;
    let usageBytes: number | null = null;
    let quotaBytes: number | null = null;
    if (navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      usageBytes = est.usage ?? null;
      quotaBytes = est.quota ?? null;
    }
    setStatus({ persisted, usageBytes, quotaBytes, supported });
  }, [supported]);

  const request = useCallback(async () => {
    if (supported && navigator.storage.persist) {
      await navigator.storage.persist();
      await refresh();
    }
  }, [supported, refresh]);

  useEffect(() => {
    // Reading navigator.storage (an external async API) and storing the result is
    // a valid effect — synchronizing React with an external system. setState runs
    // post-await, not synchronously; the lint rule is a heuristic that over-fires here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { ...status, refresh, request };
}
