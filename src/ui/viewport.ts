/**
 * The Home Screen viewport. Measured on Noah's iPhone 14, iOS 18.7, 2026-09-28 (the tune
 * panel's Screen readout): with the black-translucent status bar WebKit sizes the app's
 * window to the screen minus the TOP safe area, anchored at the top (797 of 844 pt), and
 * iOS paints the 47 pt below it itself (the 09-27 build that stretched the shell there had
 * its island covered by that bar). Content under the status bar (safe top > 0) plus a
 * short window therefore means the bottom strip is not ours: --os-bottom-inset becomes 0
 * and the island and every dock sit just above the window's edge.
 *
 * With an opaque status bar ("black" or "default", tried from 09-28) the window starts
 * below the status bar and reaches the true bottom, so safe top is 0 and the island clears
 * the home indicator with env(safe-area-inset-bottom), as in a browser tab.
 *
 * `?probe` (or `#/route?probe`) in the URL, or the tune panel's Screen section, shows the
 * numbers on screen for device QA.
 */
export function installViewportFix(): () => void {
  if (typeof window === 'undefined') return () => {};
  const root = document.documentElement;
  const standalone = () =>
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const measure = () => {
    const portrait = window.innerHeight >= window.innerWidth;
    const screenH = portrait
      ? Math.max(screen.height, screen.width)
      : Math.min(screen.height, screen.width);
    const gap = standalone()
      ? Math.max(0, Math.min(60, screenH - window.innerHeight))
      : 0;
    root.style.setProperty('--os-vgap', `${gap}px`);
    const bottomIsTheOs = standalone() && gap >= 20 && safeTop() > 0;
    root.style.setProperty(
      '--os-bottom-inset',
      bottomIsTheOs ? '0px' : 'env(safe-area-inset-bottom, 0px)',
    );
    if (probeWanted()) paintProbe();
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
  window.visualViewport?.addEventListener('resize', measure);
  return () => {
    window.removeEventListener('resize', measure);
    window.removeEventListener('orientationchange', measure);
    window.visualViewport?.removeEventListener('resize', measure);
  };
}

/** env(safe-area-inset-top) in px: above 0 when the page draws under the status bar. */
function safeTop(): number {
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;left:-9999px;top:0;visibility:hidden;padding-top:env(safe-area-inset-top)';
  document.body.appendChild(d);
  const v = parseFloat(getComputedStyle(d).paddingTop) || 0;
  d.remove();
  return v;
}

function probeWanted(): boolean {
  return /[?&]probe/.test(location.search) || /[?&]probe/.test(location.hash);
}

function paintProbe() {
  let el = document.getElementById('os-probe');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'os-probe';
    el.style.cssText =
      'position:fixed;left:8px;top:60px;z-index:9999;margin:0;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.8);color:#fff;font:11px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
  }
  el.textContent = viewportReadout().join('\n');
}

/** Every number that decides where the bottom of the app is, for device QA. Shown by
 *  `?probe` and in the feel tuning panel (the Home Screen app has no address bar). */
export function viewportReadout(): string[] {
  const px = (css: string, prop: 'height' | 'paddingTop' | 'paddingBottom') => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:-9999px;top:0;width:1px;visibility:hidden;${css}`;
    document.body.appendChild(d);
    const v = Math.round(parseFloat(getComputedStyle(d)[prop]) || 0);
    d.remove();
    return v;
  };
  const r = (sel: string) =>
    document.querySelector(sel)?.getBoundingClientRect();
  const shell = r('.os-shell');
  const tabs = r('.os-tabs');
  const root = getComputedStyle(document.documentElement);
  const vv = window.visualViewport;
  const standalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const screenH = Math.max(screen.height, screen.width);
  const ios = /OS (\d+)[_.](\d+)/.exec(navigator.userAgent);
  return [
    `standalone ${standalone ? 'yes' : 'no'}${ios ? `, iOS ${ios[1]}.${ios[2]}` : ''}`,
    `screen ${screen.width}x${screen.height}`,
    `window ${window.innerWidth}x${window.innerHeight}, doc ${document.documentElement.clientHeight}`,
    `visual ${Math.round(vv?.width ?? 0)}x${Math.round(vv?.height ?? 0)} at ${Math.round(vv?.offsetTop ?? 0)}`,
    `dvh ${px('height:100dvh', 'height')}, svh ${px('height:100svh', 'height')}, lvh ${px('height:100lvh', 'height')}`,
    `safe top ${px('padding-top:env(safe-area-inset-top)', 'paddingTop')}, bottom ${px('padding-bottom:env(safe-area-inset-bottom)', 'paddingBottom')}`,
    `vgap ${root.getPropertyValue('--os-vgap').trim() || '-'}, bottom inset ${root.getPropertyValue('--os-bottom-inset').trim() || '-'}`,
    shell
      ? `shell ${Math.round(shell.top)} to ${Math.round(shell.bottom)}`
      : 'shell -',
    tabs
      ? `island bottom ${Math.round(tabs.bottom)}, ${Math.round(window.innerHeight - tabs.bottom)} above window, ${Math.round(screenH - tabs.bottom)} above screen`
      : 'island not on this screen',
  ];
}
