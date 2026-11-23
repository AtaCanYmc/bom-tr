import { Activity, ExternalLink, Wifi, WifiOff } from 'lucide-react';
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
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="font-medium text-slate-100">robo-api Bağlantısı</div>
          {apiHealth ? (
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                apiHealth.online
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {apiHealth.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {apiHealth.online ? 'Çevrimiçi' : 'Offline Fallback'}
            </span>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-slate-400">
            API Adresi (varsayılan localhost veya Tailscale/LAN)
          </label>
          <div className="flex gap-1.5">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              disabled={checking}
              onClick={() => void handleSaveAndCheck()}
              className="inline-flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <Activity className="h-3.5 w-3.5" />
              {checking ? 'Test...' : 'Kaydet & Test'}
            </button>
          </div>
          {apiHealth && !apiHealth.online && (
            <div className="mt-1.5 rounded border border-amber-500/30 bg-amber-950/20 p-2 text-[11px] text-amber-200">
              API erişilemiyor. Yerel BOM düzenleme, JSON içe/dışa aktarım ve 6 mağaza{' '}
              <code>?q=...</code> arama sekmeleri offline çalışmaya devam eder.
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-400">Teslimat</span>
            <input
              type="text"
              value={settings.deliveryDestination}
              onChange={(e) => updateSettings({ deliveryDestination: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-400">Para Birimi</span>
            <input
              type="text"
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] text-slate-400">Sekme Gecikmesi (ms)</span>
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
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
        <div className="font-medium text-slate-100">Offline 6 Mağaza Arama (?q=...)</div>
        <form onSubmit={handleOfflineSearch} className="flex gap-1.5">
          <input
            type="text"
            value={offlineQuery}
            onChange={(e) => setOfflineQuery(e.target.value)}
            placeholder="Örn: ESP32-WROOM-32"
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={!offlineQuery.trim()}
            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            6 Sekme Aç
          </button>
        </form>
        <div className="flex flex-wrap gap-1 text-[10px] text-slate-400">
          {STORE_LIST.map((s) => (
            <span key={s.id} className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5">
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-[11px] text-slate-400">
        Gizlilik sınırı: Yalnızca parça arama terimleri ve BOM adetleri API&apos;ye gönderilir.
        Proje dosyaları, kimlik bilgileri veya ilgisiz sayfa içerikleri gönderilmez.
      </div>
    </div>
  );
}
