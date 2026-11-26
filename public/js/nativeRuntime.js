// Capacitor injects this bridge only inside the installed Android app.
export function isNativeApp() {
  return Boolean(globalThis.Capacitor?.isNativePlatform?.());
}

export const DEFAULT_API_ORIGIN = 'https://i-tutor-alpha.vercel.app';
const apiOrigin = typeof __ITUTOR_API_ORIGIN__ === 'string' ? __ITUTOR_API_ORIGIN__ : DEFAULT_API_ORIGIN;

export function resolveApiUrl(value, native = isNativeApp()) {
  // Keep packaged assets local, and never redirect signed uploads/external URLs.
  if (!native || typeof value !== 'string' || !value.startsWith('/api/')) return value;
  return `${apiOrigin}${value}`;
}

export function apiFetch(value, options) {
  return fetch(resolveApiUrl(value), options);
}

export async function initializeNativeApp({ onBack, onResume } = {}) {
  if (!isNativeApp()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => onBack?.(() => App.minimizeApp()));
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onResume?.();
  });
}
