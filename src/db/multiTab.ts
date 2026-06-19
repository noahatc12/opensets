/**
 * Multi-tab safety (spec refinement): prevent two tabs from logging the same
 * workout and corrupting IndexedDB. A BroadcastChannel handshake — a tab opening a
 * session announces itself; if another tab already holds one, `onConflict` fires so
 * the UI can warn and go read-only. Browser-only; verified at runtime, not in node.
 */
export interface SessionGuard {
  release(): void;
}

const CHANNEL = 'opensets-active-session';

export function guardActiveSession(onConflict: () => void): SessionGuard {
  if (typeof BroadcastChannel === 'undefined') {
    return { release: () => {} };
  }
  const channel = new BroadcastChannel(CHANNEL);
  let active = true;

  channel.onmessage = (e: MessageEvent) => {
    const msg = e.data as { type?: string } | null;
    if (!active || !msg) return;
    if (msg.type === 'ping') {
      // Someone else is opening a session — tell them we already hold one.
      channel.postMessage({ type: 'present' });
    } else if (msg.type === 'present') {
      onConflict();
    }
  };

  // Ask whether any other tab already has the session open.
  channel.postMessage({ type: 'ping' });

  return {
    release: () => {
      active = false;
      channel.close();
    },
  };
}
