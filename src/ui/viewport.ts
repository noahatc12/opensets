/**
 * The Home Screen viewport. In the iOS 26 web-app container the layout viewport can stop
 * short of the screen by the bottom safe area (810 of 844 pt on an iPhone 14), so a
 * 100dvh shell ends above the home indicator, the OS paints black under it, and anything
 * placed `env(safe-area-inset-bottom)` above the shell's edge floats twice as high as it
 * should. This measures the shortfall and hands it to CSS as --os-vgap, which the shell
 * extends by; in a browser tab it stays 0 so nothing is pushed under Safari's controls.
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
    if (probeWanted()) paintProbe(gap, screenH);
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

function paintProbe(gap: number, screenH: number) {
  let el = document.getElementById('os-probe');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'os-probe';
    el.style.cssText =
      'position:fixed;left:8px;top:60px;z-index:9999;margin:0;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.8);color:#fff;font:11px/1.4 ui-monospace,monospace;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
  }
  const cs = getComputedStyle(
    document.querySelector('.os-shell') ?? document.documentElement,
  );
  el.textContent = [
    `standalone ${matchMedia('(display-mode: standalone)').matches}`,
    `screen ${screen.width}x${screen.height} (h used ${screenH})`,
    `inner ${window.innerWidth}x${window.innerHeight}`,
    `visual ${Math.round(window.visualViewport?.width ?? 0)}x${Math.round(window.visualViewport?.height ?? 0)}`,
    `gap ${gap}px`,
    `inset-bottom ${cs.getPropertyValue('--os-probe-inset').trim() || '?'}`,
    `dvh ${cs.getPropertyValue('--os-probe-dvh').trim() || '?'}`,
  ].join('\n');
}
