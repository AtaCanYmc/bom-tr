import { AlertTriangle, Calculator, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { CandidateEvidence, CartScenario } from '../../shared/bom';
import { sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

export function CartTab() {
  const { projects, activeProjectId, settings, lastOptimization, setLastOptimization, setNotice } =
    useWorkspaceStore();
  const [includeOptional, setIncludeOptional] = useState(false);
  const [running, setRunning] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);
  if (!project) return null;

  const eligibleItems = project.items.filter((entry) =>
    includeOptional ? true : entry.bom.status !== 'optional_or_assumed',
  );

  const handleOptimize = async () => {
    if (eligibleItems.length === 0) {
      setNotice('Optimize edilecek BOM kalemi bulunamadı.');
      return;
    }

    const requestItems = eligibleItems.map((entry) => ({
      query: entry.bom.search_queries[0] || entry.bom.canonical_name,
      quantity: entry.bom.quantity ?? 1,
    }));

    const localCandidatesByQuery: Record<string, CandidateEvidence[]> = {};
    for (const entry of eligibleItems) {
      const q = entry.bom.search_queries[0] || entry.bom.canonical_name;
      if (entry.candidates.length > 0) {
        localCandidatesByQuery[q] = entry.candidates;
      }
    }

    setRunning(true);
    const res = await sendBackgroundMessage({
      type: 'OPTIMIZE_CART',
      apiBaseUrl: settings.apiBaseUrl,
      items: requestItems,
      localCandidatesByQuery,
    });
    setRunning(false);

    if (res.ok && 'optimization' in res) {
      setLastOptimization(res.optimization);
      return;
    }
    setNotice(!res.ok ? res.error : 'Sepet optimizasyonu başarısız.');
  };

  const handleOpenScenarioTabs = async (scenario: CartScenario) => {
    const urls = scenario.stores.flatMap((store) => store.items.map((item) => item.url));
    if (urls.length === 0) return;
    const res = await sendBackgroundMessage({
      type: 'OPEN_TABS_STAGGERED',
      urls,
      delayMs: settings.batchTabDelayMs,
    });
    if (res.ok && 'openedCount' in res) {
      setNotice(`${scenario.label} için ${res.openedCount} ürün sekmesi kontrollü açıldı.`);
    }
  };

  const renderScenario = (scenario: CartScenario) => (
    <article key={scenario.kind} className="wb-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
          {scenario.label}
        </h3>
        <span className="font-mono-tech tabular-nums rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
          Kapsama: {scenario.coverageCount}/{scenario.requestedCount}
        </span>
      </div>

      <div className="wb-inset mt-2.5 grid grid-cols-3 gap-2 p-2.5 text-center text-[11px]">
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">Ara Toplam</div>
          <div className="font-mono-tech tabular-nums font-medium text-[var(--text-primary)]">
            {scenario.itemsSubtotal.toFixed(2)} {scenario.currency}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">Kargo</div>
          <div className="font-mono-tech tabular-nums font-medium text-[var(--text-primary)]">
            {scenario.shippingTotal.toFixed(2)} {scenario.currency}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-muted)]">Genel Toplam</div>
          <div
            className="font-mono-tech tabular-nums font-semibold"
            style={{ color: 'var(--status-ok)' }}
          >
            {scenario.grandTotal.toFixed(2)} {scenario.currency}
          </div>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {scenario.stores.map((st) => (
          <div key={st.store} className="wb-inset p-2">
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--text-primary)]">
              <span className="font-mono-tech">{st.store}</span>
              <span className="font-mono-tech tabular-nums text-[var(--text-secondary)]">
                {st.subtotal.toFixed(2)} + {st.shippingFee.toFixed(2)} kargo
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-[10px] text-[var(--text-muted)]">
              {st.items.map((line) => (
                <div key={`${st.store}:${line.url}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className="font-mono-tech tabular-nums">{line.quantity}x</span>{' '}
                    {line.title}
                  </span>
                  <span className="font-mono-tech tabular-nums shrink-0 text-[var(--text-secondary)]">
                    {line.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {scenario.missingItems.length > 0 && (
        <div
          className="mt-2 rounded-[var(--radius-sm)] border px-2 py-1.5 text-[10px]"
          style={{
            borderColor: 'var(--status-warn-border)',
            backgroundColor: 'var(--status-warn-bg)',
            color: 'var(--status-warn)',
          }}
        >
          Eksik kalemler: {scenario.missingItems.join(', ')}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleOpenScenarioTabs(scenario)}
        className="wb-btn-secondary mt-2.5 inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-2 text-[11px]"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Ürün Sekmelerini Aç ({scenario.stores.reduce((n, s) => n + s.items.length, 0)})
      </button>
    </article>
  );

  return (
    <div className="space-y-3 text-xs">
      <section className="wb-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
              Sepet Kıyaslama
            </h2>
            <p className="mt-0.5 font-mono-tech tabular-nums text-[11px] text-[var(--text-muted)]">
              {eligibleItems.length} kalem / {settings.deliveryDestination} ({settings.currency})
            </p>
          </div>
          <button
            type="button"
            disabled={running || eligibleItems.length === 0}
            onClick={() => void handleOptimize()}
            className="wb-btn-primary inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
            {running ? 'Hesaplanıyor...' : 'Sepeti Optimize Et'}
          </button>
        </div>

        <label className="mt-2.5 flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={includeOptional}
            onChange={(e) => setIncludeOptional(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          <span>
            <code className="font-mono-tech">optional_or_assumed</code> kalemleri senaryoya dahil et
          </span>
        </label>
      </section>

      {!lastOptimization ? (
        <div className="wb-card border-dashed p-5 text-center">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            Henüz sepet senaryosu hesaplanmadı.
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Tek mağaza ve bölünmüş mağaza toplamlarını kargo eşikleriyle kıyaslamak için{' '}
            <strong>Sepeti Optimize Et</strong> düğmesine basın.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {lastOptimization.winningLabel && (
            <div
              className="rounded-[var(--radius-md)] border px-3 py-2 text-[11px]"
              style={{
                borderColor: 'var(--status-ok-border)',
                backgroundColor: 'var(--status-ok-bg)',
                color: 'var(--status-ok)',
              }}
            >
              Öneri: <strong>{lastOptimization.winningLabel}</strong>
            </div>
          )}

          {lastOptimization.warnings.map((w, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-[var(--radius-md)] border p-2.5 text-[11px]"
              style={{
                borderColor: 'var(--status-warn-border)',
                backgroundColor: 'var(--status-warn-bg)',
                color: 'var(--status-warn)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{w}</span>
            </div>
          ))}

          {lastOptimization.singleStore && renderScenario(lastOptimization.singleStore)}
          {lastOptimization.splitStore && renderScenario(lastOptimization.splitStore)}

          <div className="wb-inset p-2.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
            Kaynak: <code className="font-mono-tech">{lastOptimization.source}</code> / Sorgu:{' '}
            <span className="font-mono-tech tabular-nums">
              {new Date(lastOptimization.observedAt).toLocaleString('tr-TR')}
            </span>
            . Fiyat ve stoklar yalnızca sorgu anına ait kanıttır; otomatik sipariş verilmez.
          </div>
        </div>
      )}
    </div>
  );
}
