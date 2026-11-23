import { Activity, ExternalLink, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { SUPPORTED_LOCALES, type Locale } from '../../shared/bom';
import { LOCALE_LABELS, t } from '../../shared/i18n';
import { STORE_LIST, buildFallbackSearchUrls } from '../../shared/stores';
import { ensureOriginPermission, sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

export function SettingsTab() {
  const { settings, apiHealth, updateSettings, setApiHealth, setNotice } = useWorkspaceStore();
  const [urlInput, setUrlInput] = useState(settings.apiBaseUrl);
  const [checking, setChecking] = useState(false);
  const [offlineQuery, setOfflineQuery] = useState('');

  const loc = settings.locale;

  const handleSaveAndCheck = async () => {
    const clean = urlInput.trim().replace(/\/+$/, '');
    try {
      const granted = await ensureOriginPermission(clean);
      if (!granted) {
        setNotice('Origin permission denied.');
        return;
      }
    } catch {
      setNotice('Invalid API URL. Example: http://127.0.0.1:8000');
      return;
    }

    updateSettings({ apiBaseUrl: clean });
    setChecking(true);
    const res = await sendBackgroundMessage({ type: 'CHECK_API_HEALTH', apiBaseUrl: clean });
    setChecking(false);

    if (res.ok && 'health' in res) {
      setApiHealth(res.health);
      setNotice(
        res.health.online
          ? `robo-api ${t(loc, 'online')}${res.health.version ? ` (v${res.health.version})` : ''}.`
          : `robo-api ${t(loc, 'offline')}: ${res.health.error ?? 'no response'}`,
      );
    } else if (!res.ok) {
      setApiHealth({
        online: false,
        checkedAt: new Date().toISOString(),
        error: res.error,
      });
    }
  };

  const handleOfflineSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = buildFallbackSearchUrls(offlineQuery).map((x) => x.url);
    if (urls.length === 0) return;
    const res = await sendBackgroundMessage({
      type: 'OPEN_TABS_STAGGERED',
      urls,
      delayMs: settings.batchTabDelayMs,
    });
    if (res.ok && 'openedCount' in res) {
      setNotice(`${res.openedCount} tabs opened for "${offlineQuery}".`);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <section className="wb-card space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
            {t(loc, 'apiSectionTitle')}
          </h2>
          {apiHealth ? (
            <span
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap"
              style={
                apiHealth.online
                  ? {
                      borderColor: 'var(--status-ok-border)',
                      backgroundColor: 'var(--status-ok-bg)',
                      color: 'var(--status-ok)',
                    }
                  : {
                      borderColor: 'var(--status-warn-border)',
                      backgroundColor: 'var(--status-warn-bg)',
                      color: 'var(--status-warn)',
                    }
              }
            >
              {apiHealth.online ? (
                <Wifi className="h-3 w-3" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              )}
              {apiHealth.online ? t(loc, 'online') : t(loc, 'offlineFallback')}
            </span>
          ) : null}
        </div>

        <div>
          <label htmlFor="api-base-url" className="mb-1 block text-[11px] text-[var(--text-muted)]">
            {t(loc, 'apiUrlLabel')}
          </label>
          <div className="flex gap-1.5">
            <input
              id="api-base-url"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="wb-input font-mono-tech flex-1 px-2.5 py-1.5 text-xs"
            />
            <button
              type="button"
              disabled={checking}
              onClick={() => void handleSaveAndCheck()}
              className="wb-btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            >
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              {checking ? t(loc, 'testing') : t(loc, 'saveAndTest')}
            </button>
          </div>
          {apiHealth && !apiHealth.online && (
            <div
              className="mt-2 rounded-[var(--radius-md)] border p-2.5 text-[11px]"
              style={{
                borderColor: 'var(--status-warn-border)',
                backgroundColor: 'var(--status-warn-bg)',
                color: 'var(--status-warn)',
              }}
            >
              {t(loc, 'apiOfflineHint')}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-muted)]">
              {t(loc, 'deliveryLabel')}
            </span>
            <input
              type="text"
              value={settings.deliveryDestination}
              onChange={(e) => updateSettings({ deliveryDestination: e.target.value })}
              className="wb-input font-mono-tech w-full px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-muted)]">
              {t(loc, 'currencyLabel')}
            </span>
            <input
              type="text"
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value.toUpperCase() })}
              className="wb-input font-mono-tech w-full px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-muted)]">
              {t(loc, 'delayLabel')}
            </span>
            <input
              type="number"
              min={150}
              max={2000}
              step={50}
              value={settings.batchTabDelayMs}
              onChange={(e) =>
                updateSettings({
                  batchTabDelayMs: Math.max(150, Number.parseInt(e.target.value, 10) || 350),
                })
              }
              className="wb-input font-mono-tech tabular-nums w-full px-2 py-1.5 text-xs"
            />
          </label>
        </div>

        <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-[var(--text-primary)]">
                {t(loc, 'appearanceTitle')}
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {t(loc, 'shortcutHint')}: <code className="font-mono-tech">Ctrl+Shift+B</code> /{' '}
                <code className="font-mono-tech">Cmd+Shift+B</code>
              </div>
            </div>
            <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-0.5">
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                aria-pressed={settings.theme === 'dark'}
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-medium whitespace-nowrap"
                style={
                  settings.theme === 'dark'
                    ? { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                <Moon className="h-3 w-3" aria-hidden="true" />
                {t(loc, 'dark')}
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                aria-pressed={settings.theme === 'light'}
                className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-medium whitespace-nowrap"
                style={
                  settings.theme === 'light'
                    ? { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                <Sun className="h-3 w-3" aria-hidden="true" />
                {t(loc, 'light')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--text-secondary)]">
              {t(loc, 'languageLabel')}
            </span>
            <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-input)] p-0.5">
              {SUPPORTED_LOCALES.map((code: Locale) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => updateSettings({ locale: code })}
                  aria-pressed={settings.locale === code}
                  className="font-mono-tech rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-semibold"
                  style={
                    settings.locale === code
                      ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {LOCALE_LABELS[code]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="wb-card space-y-2.5 p-3">
        <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
          {t(loc, 'offlineSearchTitle')}
        </h2>
        <form onSubmit={handleOfflineSearch} className="flex gap-1.5">
          <input
            type="text"
            value={offlineQuery}
            onChange={(e) => setOfflineQuery(e.target.value)}
            aria-label={t(loc, 'offlineSearchTitle')}
            placeholder="ESP32-WROOM-32"
            className="wb-input flex-1 px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={!offlineQuery.trim()}
            className="wb-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {t(loc, 'openSixTabs')}
          </button>
        </form>
        <div className="flex flex-wrap gap-1">
          {STORE_LIST.map((s) => (
            <span
              key={s.id}
              className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
            >
              {s.name}
            </span>
          ))}
        </div>
      </section>

      <div className="wb-inset p-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {t(loc, 'privacyNote')}
      </div>
    </div>
  );
}
