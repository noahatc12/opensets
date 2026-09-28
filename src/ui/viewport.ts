/**
 * The Home Screen viewport. In the iOS 26 web-app container the layout viewport can stop
 * short of the screen by the bottom safe area (810 of 844 pt on an iPhone 14), so a
 * 100dvh shell ends above the home indicator, the OS paints black under it, and anything
 * placed `env(safe-area-inset-bottom)` above the shell's edge floats twice as high as it
 * should. The zone below the short edge is the container's own and cannot be painted, so
 * the fix is the other way round: when the viewport is short by the inset, the inset is
 * already reserved and --os-bottom-inset becomes 0, which drops the island and every dock
 * to the edge. In a browser tab, and in a container that does extend under the indicator,
 * the inset stays env(safe-area-inset-bottom).
 *
 * `?probe` (or `#/route?probe`) in the URL shows the numbers on screen for device QA.
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
    root.style.setProperty(
      '--os-bottom-inset',
      standalone() && gap >= 20 ? '0px' : 'env(safe-area-inset-bottom, 0px)',
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
