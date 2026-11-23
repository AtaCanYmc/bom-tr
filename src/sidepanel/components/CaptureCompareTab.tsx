import { AlertCircle, ExternalLink, PlusCircle, Radar, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import type { CandidateEvidence } from '../../shared/bom';
import { t } from '../../shared/i18n';
import { STORE_LIST, buildFallbackSearchUrls, sanitizeHttpUrl } from '../../shared/stores';
import { sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

export function CaptureCompareTab() {
  const { settings, lastCapture, setLastCapture, addItemFromCapture, setNotice } =
    useWorkspaceStore();
  const [loadingCapture, setLoadingCapture] = useState(false);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [compared, setCompared] = useState<CandidateEvidence[]>([]);
  const [compareObservedAt, setCompareObservedAt] = useState<string | null>(null);
  const loc = settings.locale;

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
      <section className="wb-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
              {t(loc, 'activeStoreTitle')}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              {t(loc, 'activeStoreDesc')}
            </p>
          </div>
          <button
            type="button"
            disabled={loadingCapture}
            onClick={() => void handleCapture()}
            className="wb-btn-primary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
            {loadingCapture ? t(loc, 'reading') : t(loc, 'readPage')}
          </button>
        </div>

        {!lastCapture ? (
          <div className="wb-inset mt-3 p-3">
            <p className="text-[11px] text-[var(--text-secondary)]">{t(loc, 'noCaptureYet')}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {STORE_LIST.map((store) => (
                <span
                  key={store.id}
                  className="font-mono-tech rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                >
                  {store.name}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5 border-t border-[var(--border-subtle)] pt-3">
            {lastCapture.warning && (
              <div
                className="flex items-start gap-2 rounded-[var(--radius-md)] border p-2.5 text-[11px]"
                style={{
                  borderColor: 'var(--status-warn-border)',
                  backgroundColor: 'var(--status-warn-bg)',
                  color: 'var(--status-warn)',
                }}
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{lastCapture.warning}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
                {lastCapture.title ?? 'Ürün başlığı okunamadı'}
              </div>
              <div className="wb-inset grid grid-cols-3 gap-2 p-2 text-[11px]">
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Mağaza</div>
                  <div className="truncate font-medium text-[var(--text-primary)]">
                    {lastCapture.storeName ?? 'Desteklenmiyor'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Fiyat</div>
                  <div className="font-mono-tech tabular-nums font-semibold text-[var(--text-primary)]">
                    {lastCapture.price !== null
                      ? `${lastCapture.price.toFixed(2)} ${lastCapture.currency}`
                      : 'Okunamadı'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[var(--text-muted)]">Stok</div>
                  <div className="font-mono-tech font-medium text-[var(--text-primary)]">
                    {lastCapture.stockStatus}
                  </div>
                </div>
              </div>
              <div className="font-mono-tech tabular-nums text-[10px] text-[var(--text-muted)]">
                Okuma: {new Date(lastCapture.observedAt).toLocaleString('tr-TR')}
              </div>
            </div>

            {lastCapture.supported && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    addItemFromCapture(lastCapture);
                    setNotice("Yakalanan ürün BOM'a eklendi (onay bekliyor).");
                  }}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap"
                  style={{
                    borderColor: 'var(--status-ok-border)',
                    backgroundColor: 'var(--status-ok-bg)',
                    color: 'var(--status-ok)',
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  BOM&apos;a Ekle
                </button>
                <button
                  type="button"
                  disabled={loadingCompare || !lastCapture.title}
                  onClick={() => void handleCompareOtherStores()}
                  className="wb-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px]"
                >
                  <Radar className="h-3.5 w-3.5" aria-hidden="true" />
                  {loadingCompare ? 'Kıyaslanıyor...' : 'Diğer 5 Mağaza'}
                </button>
                <button
                  type="button"
                  disabled={!lastCapture.title}
                  onClick={() => void handleOpenOtherFiveTabs()}
                  className="wb-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px]"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Offline 5 Sekme
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {compared.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Diğer Mağaza Adayları ({compared.length})</span>
            {compareObservedAt && (
              <span className="font-mono-tech tabular-nums">
                {new Date(compareObservedAt).toLocaleTimeString('tr-TR')}
              </span>
            )}
          </div>
          {compared.map((item) => (
            <div
              key={item.id}
              className="wb-card flex items-center justify-between gap-2 p-2.5"
            >
              <div className="min-w-0">
                {sanitizeHttpUrl(item.url) ? (
                  <a
                    href={sanitizeHttpUrl(item.url)!}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span className="line-clamp-1 font-medium text-[var(--text-primary)]">
                    {item.title}
                  </span>
                )}
                <div className="font-mono-tech text-[10px] text-[var(--text-muted)]">
                  {item.store} / {item.stockStatus}
                </div>
              </div>
              <div className="font-mono-tech tabular-nums shrink-0 text-right font-semibold text-[var(--text-primary)]">
                {item.unitPrice !== null
                  ? `${item.unitPrice.toFixed(2)} ${item.currency}`
                  : 'Fiyat yok'}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
