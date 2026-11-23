import type { BackgroundRequest, BackgroundResponse } from '../shared/messages';

export function isExtensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

export async function sendBackgroundMessage(
  request: BackgroundRequest,
): Promise<BackgroundResponse> {
  if (!isExtensionRuntime()) {
    return {
      ok: false,
      error: 'Chrome eklenti çalışma zamanı algılanmadı (yerel önizleme modu).',
      offline: true,
    };
  }
  return (await chrome.runtime.sendMessage(request)) as BackgroundResponse;
}

export async function storageGet<T>(key: string): Promise<T | null> {
  if (isExtensionRuntime() && chrome.storage?.local) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? null;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  if (isExtensionRuntime() && chrome.storage?.local) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function storageRemove(key: string): Promise<void> {
  if (isExtensionRuntime() && chrome.storage?.local) {
    await chrome.storage.local.remove(key);
    return;
  }
  window.localStorage.removeItem(key);
}

// Must be called directly inside a UI click handler to preserve the Chrome user gesture.
export async function ensureOriginPermission(apiBaseUrl: string): Promise<boolean> {
  if (!isExtensionRuntime() || !chrome.permissions) return true;
  const parsed = new URL(apiBaseUrl);
  if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
    return true;
  }
  const originPattern = `${parsed.origin}/*`;
  const already = await chrome.permissions.contains({ origins: [originPattern] });
  if (already) return true;
  return chrome.permissions.request({ origins: [originPattern] });
}
