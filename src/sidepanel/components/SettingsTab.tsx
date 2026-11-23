import { Activity, ExternalLink, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { STORE_LIST, buildFallbackSearchUrls } from '../../shared/stores';
import { ensureOriginPermission, sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

export function SettingsTab() {
  const { settings, apiHealth, updateSettings, setApiHealth, setNotice } = useWorkspaceStore();
  const [urlInput, setUrlInput] = useState(settings.apiBaseUrl);
  const [checking, setChecking] = useState(false);
  const [offlineQuery, setOfflineQuery] = useState('');

  const handleSaveAndCheck = async () => {
    const clean = urlInput.trim().replace(/\/+$/, '');
    try {
      const granted = await ensureOriginPermission(clean);
      if (!granted) {
        setNotice('Özel API adresi için alan adı izni verilmedi.');
        return;
      }
    } catch {
      setNotice('Geçersiz API adresi. Örn: http://127.0.0.1:8000');
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
          ? `robo-api çevrimiçi${res.health.version ? ` (v${res.health.version})` : ''}.`
          : `robo-api çevrimdışı: ${res.health.error ?? 'yanıt yok'}`,
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
      setNotice(`6 mağazada "${offlineQuery}" araması açıldı.`);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <section className="wb-card space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
            robo-api Bağlantısı
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
              {apiHealth.online ? 'Çevrimiçi' : 'Offline Fallback'}
            </span>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="api-base-url"
            className="mb-1 block text-[11px] text-[var(--text-muted)]"
          >
            API Adresi (varsayılan localhost veya Tailscale/LAN)
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
              {checking ? 'Test...' : 'Kaydet & Test'}
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
              API erişilemiyor. Yerel BOM düzenleme, JSON içe/dışa aktarım ve 6 mağaza{' '}
              <code className="font-mono-tech">?q=...</code> arama sekmeleri offline çalışmaya devam
              eder.
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-muted)]">Teslimat</span>
            <input
              type="text"
              value={settings.deliveryDestination}
              onChange={(e) => updateSettings({ deliveryDestination: e.target.value })}
              className="wb-input font-mono-tech w-full px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-muted)]">Para Birimi</span>
            <input
              type="text"
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="wb-input font-mono-tech w-full px-2 py-1.5 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-[var(--text-muted)]">Gecikme (ms)</span>
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

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
          <div>
            <div className="text-[11px] font-medium text-[var(--text-primary)]">Görünüm Teması</div>
            <div className="text-[10px] text-[var(--text-muted)]">
              Kısayol: <code className="font-mono-tech">Ctrl+Shift+B</code> /{' '}
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
              Koyu
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
              Açık
            </button>
          </div>
        </div>
      </section>

      <section className="wb-card space-y-2.5 p-3">
        <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
          Offline 6 Mağaza Arama (?q=...)
        </h2>
        <form onSubmit={handleOfflineSearch} className="flex gap-1.5">
          <input
            type="text"
            value={offlineQuery}
            onChange={(e) => setOfflineQuery(e.target.value)}
            aria-label="Offline mağaza arama terimi"
            placeholder="Örn: ESP32-WROOM-32"
            className="wb-input flex-1 px-2.5 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={!offlineQuery.trim()}
            className="wb-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />6 Sekme Aç
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
        Gizlilik sınırı: Yalnızca parça arama terimleri ve BOM adetleri API&apos;ye gönderilir.
        Proje dosyaları, kimlik bilgileri veya ilgisiz sayfa içerikleri gönderilmez.
      </div>
    </div>
  );
}
