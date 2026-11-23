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
    <div key={scenario.kind} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-slate-100">{scenario.label}</div>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
          Kapsama: {scenario.coverageCount}/{scenario.requestedCount}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 rounded bg-slate-950/80 p-2 text-center text-[11px]">
        <div>
          <div className="text-[10px] text-slate-400">Ara Toplam</div>
          <div className="font-medium text-slate-200">
            {scenario.itemsSubtotal.toFixed(2)} {scenario.currency}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Kargo</div>
          <div className="font-medium text-slate-200">
            {scenario.shippingTotal.toFixed(2)} {scenario.currency}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">Genel Toplam</div>
          <div className="font-semibold text-emerald-300">
            {scenario.grandTotal.toFixed(2)} {scenario.currency}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {scenario.stores.map((st) => (
          <div key={st.store} className="rounded border border-slate-800/80 bg-slate-950/50 p-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-200">
              <span>{st.store}</span>
              <span>
                {st.subtotal.toFixed(2)} + {st.shippingFee.toFixed(2)} kargo
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-[10px] text-slate-400">
              {st.items.map((line) => (
                <div key={`${st.store}:${line.url}`} className="flex justify-between gap-2">
                  <span className="truncate">
                    {line.quantity}× {line.title}
                  </span>
                  <span className="shrink-0 text-slate-300">{line.lineTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {scenario.missingItems.length > 0 && (
        <div className="mt-2 text-[10px] text-amber-300">
          Eksik kalemler: {scenario.missingItems.join(', ')}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleOpenScenarioTabs(scenario)}
        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded bg-sky-700/90 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-sky-600"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Ürün Sekmelerini Aç ({scenario.stores.reduce((n, s) => n + s.items.length, 0)})
      </button>
    </div>
  );

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-medium text-slate-100">Sepet Kıyaslama</div>
            <div className="text-[11px] text-slate-400">
              {eligibleItems.length} kalem · Hedef: {settings.deliveryDestination} ({settings.currency})
            </div>
          </div>
          <button
            type="button"
            disabled={running}
            onClick={() => void handleOptimize()}
            className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            <Calculator className="h-3.5 w-3.5" />
            {running ? 'Hesaplanıyor...' : 'Sepeti Optimize Et'}
          </button>
        </div>

        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={includeOptional}
            onChange={(e) => setIncludeOptional(e.target.checked)}
            className="rounded border-slate-700 bg-slate-950"
          />
          <code>optional_or_assumed</code> kalemleri ayrı senaryoya dahil et
        </label>
      </div>

      {lastOptimization && (
        <div className="space-y-2.5">
          {lastOptimization.winningLabel && (
            <div className="rounded border border-emerald-500/40 bg-emerald-950/25 px-2.5 py-2 text-[11px] text-emerald-200">
              Öneri: <strong>{lastOptimization.winningLabel}</strong>
            </div>
          )}

          {lastOptimization.warnings.map((w, idx) => (
            <div
              key={idx}
              className="flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-950/25 p-2 text-[11px] text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}

          {lastOptimization.singleStore && renderScenario(lastOptimization.singleStore)}
          {lastOptimization.splitStore && renderScenario(lastOptimization.splitStore)}

          <div className="rounded border border-slate-800 bg-slate-950/60 p-2 text-[10px] text-slate-400">
            Kaynak: <code>{lastOptimization.source}</code> · Sorgu:{' '}
            {new Date(lastOptimization.observedAt).toLocaleString('tr-TR')}. Fiyat ve stoklar
            yalnızca sorgu anına ait kanıttır; satın alma/sipariş işlemi yapılmaz.
          </div>
        </div>
      )}
    </div>
  );
}
