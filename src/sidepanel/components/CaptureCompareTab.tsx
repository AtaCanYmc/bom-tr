import { AlertCircle, ExternalLink, PlusCircle, Radar, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import type { CandidateEvidence } from '../../shared/bom';
import { buildFallbackSearchUrls } from '../../shared/stores';
import { sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

export function CaptureCompareTab() {
  const { settings, lastCapture, setLastCapture, addItemFromCapture, setNotice } =
    useWorkspaceStore();
  const [loadingCapture, setLoadingCapture] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compared, setCompared] = useState<CandidateEvidence[]>([]);
  const [compareObservedAt, setCompareObservedAt] = useState<string | null>(null);

  const handleCapture = async () => {
    setLoadingCapture(true);
    setCompared([]);
    const res = await sendBackgroundMessage({ type: 'CAPTURE_ACTIVE_TAB' });
    setLoadingCapture(false);
    if (res.ok && 'capture' in res) {
      setLastCapture(res.capture);
      if (res.capture.warning) setNotice(res.capture.warning);
      return;
    }
    setNotice(!res.ok ? res.error : 'Sekme okunamadı.');
  };

  const handleCompareOtherStores = async () => {
    const query = lastCapture?.title?.trim();
    if (!query) {
      setNotice('Kıyaslama için önce ürün adı yakalayın.');
      return;
    }
    setLoadingCompare(true);
    const res = await sendBackgroundMessage({
      type: 'SEARCH_COMPONENT',
      apiBaseUrl: settings.apiBaseUrl,
      query,
      limit: 5,
    });
    setLoadingCompare(false);

    if (res.ok && 'candidates' in res) {
      const currentStoreId = lastCapture?.storeId;
      const filtered = currentStoreId
        ? res.candidates.filter((c) => c.store !== currentStoreId)
        : res.candidates;
      setCompared(filtered);
      setCompareObservedAt(res.observedAt);
      setNotice(
        filtered.length > 0
          ? `Diğer mağazalardan ${filtered.length} aday kanıt getirildi.`
          : 'Diğer mağazalarda eşleşen aday bulunamadı.',
      );
      return;
    }

    setNotice(
      !res.ok
        ? `API erişilemedi (${res.error}). Offline 5 mağaza arama butonunu kullanabilirsiniz.`
        : 'Kıyaslama başarısız.',
    );
  };

  const handleOpenOtherFiveTabs = async () => {
    const query = lastCapture?.title?.trim();
    if (!query) return;
    const urls = buildFallbackSearchUrls(query, lastCapture?.storeId ?? undefined).map((x) => x.url);
    const res = await sendBackgroundMessage({
      type: 'OPEN_TABS_STAGGERED',
      urls,
      delayMs: settings.batchTabDelayMs,
    });
    if (res.ok && 'openedCount' in res) {
      setNotice(`Diğer ${res.openedCount} mağaza arama sekmesi açıldı.`);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium text-slate-100">Aktif Mağaza Sayfası</div>
            <div className="text-[11px] text-slate-400">
              Yalnızca desteklenen 6 mağazada DOM okur.
            </div>
          </div>
          <button
            type="button"
            disabled={loadingCapture}
            onClick={() => void handleCapture()}
            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <ScanSearch className="h-3.5 w-3.5" />
            {loadingCapture ? 'Okunuyor...' : 'Sayfadan Oku'}
          </button>
        </div>

        {lastCapture && (
          <div className="mt-3 space-y-2 border-t border-slate-800 pt-2.5">
            {lastCapture.warning && (
              <div className="flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-950/30 p-2 text-[11px] text-amber-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{lastCapture.warning}</span>
              </div>
            )}

            <div className="space-y-1">
              <div className="font-medium text-slate-100">
                {lastCapture.title ?? 'Ürün başlığı okunamadı'}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                <span>Mağaza: {lastCapture.storeName ?? 'Desteklenmiyor'}</span>
                <span>
                  Fiyat:{' '}
                  <strong>
                    {lastCapture.price !== null
                      ? `${lastCapture.price.toFixed(2)} ${lastCapture.currency}`
                      : 'Okunamadı'}
                  </strong>
                </span>
                <span>Stok: {lastCapture.stockStatus}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Okuma zamanı: {new Date(lastCapture.observedAt).toLocaleString('tr-TR')}
              </div>
            </div>

            {lastCapture.supported && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    addItemFromCapture(lastCapture);
                    setNotice("Yakalanan ürün BOM'a eklendi (onay bekliyor).");
                  }}
                  className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-600"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Sayfadan BOM&apos;a Ekle
                </button>
                <button
                  type="button"
                  disabled={loadingCompare || !lastCapture.title}
                  onClick={() => void handleCompareOtherStores()}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  <Radar className="h-3.5 w-3.5" />
                  {loadingCompare ? 'Kıyaslanıyor...' : 'Diğer 5 Mağazada Kıyasla'}
                </button>
                <button
                  type="button"
                  disabled={!lastCapture.title}
                  onClick={() => void handleOpenOtherFiveTabs()}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  <ExternalLink className="h-3 w-3" />
                  Offline 5 Sekme
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {compared.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Diğer Mağaza Adayları ({compared.length})</span>
            {compareObservedAt && (
              <span>Sorgu: {new Date(compareObservedAt).toLocaleTimeString('tr-TR')}</span>
            )}
          </div>
          {compared.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/70 p-2"
            >
              <div className="min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-1 font-medium text-slate-200 hover:text-sky-300"
                >
                  {item.title}
                </a>
                <div className="text-[10px] text-slate-400">
                  {item.store} · {item.stockStatus}
                </div>
              </div>
              <div className="shrink-0 text-right font-semibold text-slate-100">
                {item.unitPrice !== null ? `${item.unitPrice.toFixed(2)} ${item.currency}` : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
