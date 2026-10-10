// Native phone integration (Capacitor). Everything here is optional: in a browser
// `globalThis.Capacitor` is absent and nothing happens. Plugins are reached through
// the Capacitor bridge, so the web build needs no bundler or npm imports.

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { App } from './ui/app.js';

interface Listener { remove(): Promise<void> | void }

export function isNative(): boolean {
  const cap = (globalThis as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function platform(): 'android' | 'ios' | 'web' {
  const p = (globalThis as any).Capacitor?.getPlatform?.();
  return p === 'android' || p === 'ios' ? p : 'web';
}

export function initNative(app: App) {
  if (!isNative()) return;
  const cap = (globalThis as any).Capacitor;
  const plugins = cap.Plugins ?? {};
  document.documentElement.classList.add('native', `native-${platform()}`);

  // Immersive full screen: hide the status and navigation bars where the plugin allows.
  const hideBars = () => {
    try { plugins.SystemBars?.hide?.(); } catch { /* not available */ }
    try { plugins.StatusBar?.setOverlaysWebView?.({ overlay: true }); } catch { /* not available */ }
    try { plugins.StatusBar?.hide?.(); } catch { /* not available */ }
  };
  hideBars();

  // Android back button: the current screen's back action; on a top-level screen,
  // send the app to the background rather than closing it mid-session.
  try {
    const AppPlugin = plugins.App;
    if (AppPlugin?.addListener) {
      const l: Promise<Listener> | Listener = AppPlugin.addListener('backButton', () => {
        const back = app.screen?.back;
        if (back) back();
        else AppPlugin.minimizeApp?.();
      });
      void l;
      // Coming back to the app: re-hide the bars (Android shows them again).
      AppPlugin.addListener('resume', hideBars);
    }
  } catch { /* plugin missing: the history-based back handler in App still works */ }
}
