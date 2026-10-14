// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWakeLock } from './wakeLock';

// Quick win (review 2026-10-14): the screen stays awake while a workout is open.
// The browser drops the lock whenever the page is hidden, so it is taken again on
// return; where the API is missing or refuses, nothing breaks.

function fakeWakeLock() {
  const released: number[] = [];
  let n = 0;
  const request = vi.fn(async () => {
    const id = ++n;
    return { release: vi.fn(async () => void released.push(id)) };
  });
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
  });
  return { request, released };
}

function setVisibility(v: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    value: v,
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).wakeLock;
  setVisibility('visible');
});

describe('useWakeLock', () => {
  it('takes a screen lock while active and releases it on unmount', async () => {
    const { request, released } = fakeWakeLock();
    const h = renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
    h.unmount();
    await flush();
    expect(released).toEqual([1]);
  });

  it('takes the lock again when the page comes back into view', async () => {
    const { request } = fakeWakeLock();
    renderHook(() => useWakeLock(true));
    await flush();
    setVisibility('hidden');
    setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing when inactive', async () => {
    const { request } = fakeWakeLock();
    renderHook(() => useWakeLock(false));
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it('does not throw where the browser has no wake lock or refuses it', async () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: vi.fn(async () => Promise.reject(new Error('denied'))),
      },
      configurable: true,
    });
    renderHook(() => useWakeLock(true));
    await flush();
  });
});
