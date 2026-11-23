import { AlertTriangle, CheckCircle2, ExternalLink, Lock, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  BOM_STATUSES,
  MATCH_CONFIDENCES,
  STOCK_STATUSES,
  createEmptyBomItem,
  type BomStatus,
  type MatchConfidence,
  type StockStatus,
  type WorkspaceBomItem,
} from '../../shared/bom';
import { buildFallbackSearchUrls } from '../../shared/stores';
import { sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

const STATUS_BADGE: Record<BomStatus, string> = {
  confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  inferred_required: 'bg-amber-500/20 text-amber-200 border-amber-400/50',
  optional_or_assumed: 'bg-slate-700/60 text-slate-300 border-slate-600',
};

const CONFIDENCE_BADGE: Record<MatchConfidence, string> = {
  exact: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  partial: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/40',
  ambiguous: 'bg-rose-500/20 text-rose-200 border-rose-400/50',
  unmatched: 'bg-slate-800 text-slate-400 border-slate-700',
};

const STOCK_BADGE: Record<StockStatus, string> = {
  in_stock: 'text-emerald-300',
  low_stock: 'text-amber-300',
  out_of_stock: 'text-rose-300',
  unknown: 'text-slate-400',
};

export function BomTab() {
  const {
    projects,
    activeProjectId,
    settings,
    addItem,
    updateItemBom,
    removeItem,
    attachCandidates,
    selectCandidate,
    setNotice,
  } = useWorkspaceStore();

  const [onlyAttention, setOnlyAttention] = useState(false);
  const [newPartName, setNewPartName] = useState('');
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === activeProjectId);
  if (!project) return null;

  const isAttention = (item: WorkspaceBomItem) =>
    item.bom.status === 'inferred_required' || item.bom.match_confidence === 'ambiguous';

  const attentionCount = project.items.filter(isAttention).length;

  // Surface inferred_required and ambiguous items first.
  const visibleItems = [...project.items]
    .filter((item) => (!onlyAttention ? true : isAttention(item)))
    .sort((a, b) => Number(isAttention(b)) - Number(isAttention(a)));

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;
    addItem(createEmptyBomItem(newPartName));
    setNewPartName('');
  };

  const handleApiSearch = async (item: WorkspaceBomItem) => {
    const query = item.bom.search_queries[0] || item.bom.canonical_name;
    setSearchingId(item.id);
    const res = await sendBackgroundMessage({
      type: 'SEARCH_COMPONENT',
      apiBaseUrl: settings.apiBaseUrl,
      query,
      limit: 5,
    });
    setSearchingId(null);

    if (res.ok && 'candidates' in res) {
      attachCandidates(item.id, res.candidates);
      setExpandedId(item.id);
      setNotice(
        res.candidates.length > 0
          ? `"${query}" için ${res.candidates.length} aday kanıt yüklendi.`
          : `"${query}" için sonuç dönmedi.`,
      );
      return;
    }

    setNotice(
      !res.ok
        ? `API araması başarısız (${res.error}). Offline "?q=" butonunu kullanabilirsiniz.`
        : 'Arama yanıtı alınamadı.',
    );
  };

  const handleOpenFallbackTabs = async (query: string) => {
    const urls = buildFallbackSearchUrls(query).map((x) => x.url);
    const res = await sendBackgroundMessage({
      type: 'OPEN_TABS_STAGGERED',
      urls,
      delayMs: settings.batchTabDelayMs,
    });
    if (res.ok && 'openedCount' in res) {
      setNotice(`${res.openedCount} mağaza arama sekmesi açıldı.`);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleQuickAdd} className="flex gap-1.5">
        <input
          type="text"
          value={newPartName}
          onChange={(e) => setNewPartName(e.target.value)}
          placeholder="Yeni parça ekle (örn. AMS1117 3.3V)"
          className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Ekle
        </button>
      </form>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Toplam <strong className="text-slate-200">{project.items.length}</strong> kalem
        </span>
        <button
          type="button"
          onClick={() => setOnlyAttention((v) => !v)}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 ${
            onlyAttention
              ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          İnceleme Gereken ({attentionCount})
        </button>
      </div>

      <div className="space-y-2">
        {visibleItems.map((entry) => {
          const { bom } = entry;
          const highlighted = isAttention(entry);
          const expanded = expandedId === entry.id;
          const selected = entry.candidates.find((c) => c.id === entry.selectedCandidateId);

          return (
            <div
              key={entry.id}
              className={`rounded-lg border p-2.5 text-xs transition ${
                highlighted
                  ? 'border-amber-500/50 bg-amber-950/15'
                  : 'border-slate-800 bg-slate-900/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    className="text-left font-medium text-slate-100 hover:text-sky-300"
                  >
                    {bom.canonical_name}
                  </button>
                  <div className="truncate text-[11px] text-slate-400">Ham: {bom.raw_name}</div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    placeholder="?"
                    value={bom.quantity ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        updateItemBom(entry.id, { quantity: null });
                        return;
                      }
                      const n = Number.parseInt(raw, 10);
                      if (Number.isInteger(n) && n >= 1) {
                        updateItemBom(entry.id, { quantity: n });
                      }
                    }}
                    title="Adet (boş = null)"
                    className="w-12 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(entry.id)}
                    title="Kalemi sil"
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
                <span className={`rounded border px-1.5 py-0.5 ${STATUS_BADGE[bom.status]}`}>
                  {bom.status}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 ${CONFIDENCE_BADGE[bom.match_confidence]}`}
                >
                  {bom.match_confidence}
                </span>
                <span className={`px-1 font-medium ${STOCK_BADGE[bom.stock_status]}`}>
                  {bom.stock_status}
                </span>
                {entry.selectionLocked && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                    <Lock className="h-2.5 w-2.5" />
                    Onaylı
                  </span>
                )}
              </div>

              {selected && (
                <div className="mt-1.5 flex items-center justify-between rounded bg-slate-950/80 px-2 py-1 text-[11px]">
                  <span className="truncate text-slate-300">
                    {selected.store}:{' '}
                    <strong className="text-slate-100">
                      {selected.unitPrice !== null
                        ? `${selected.unitPrice.toFixed(2)} ${selected.currency}`
                        : 'Fiyat yok'}
                    </strong>
                  </span>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-sky-400 hover:text-sky-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={searchingId === entry.id}
                  onClick={() => void handleApiSearch(entry)}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  <Search className="h-3 w-3" />
                  {searchingId === entry.id ? 'Aranıyor...' : 'API Ara'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenFallbackTabs(bom.search_queries[0] || bom.canonical_name)
                  }
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  <ExternalLink className="h-3 w-3" />
                  6 Mağaza (?q=)
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                  className="ml-auto text-[11px] text-slate-400 hover:text-slate-200"
                >
                  {expanded ? 'Gizle' : `Detay (${entry.candidates.length})`}
                </button>
              </div>

              {expanded && (
                <div className="mt-2.5 space-y-2 border-t border-slate-800 pt-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <select
                      value={bom.status}
                      onChange={(e) =>
                        updateItemBom(entry.id, { status: e.target.value as BomStatus })
                      }
                      className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px]"
                    >
                      {BOM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bom.match_confidence}
                      onChange={(e) =>
                        updateItemBom(entry.id, {
                          match_confidence: e.target.value as MatchConfidence,
                        })
                      }
                      className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px]"
                    >
                      {MATCH_CONFIDENCES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bom.stock_status}
                      onChange={(e) =>
                        updateItemBom(entry.id, {
                          stock_status: e.target.value as StockStatus,
                        })
                      }
                      className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px]"
                    >
                      {STOCK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    rows={2}
                    value={bom.notes}
                    onChange={(e) => updateItemBom(entry.id, { notes: e.target.value })}
                    placeholder="Notlar, çakışmalar, doğrulama gereksinimleri..."
                    className="w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-[11px] text-slate-200"
                  />

                  <div className="text-[10px] text-slate-400">
                    Kaynaklar: {bom.source_files.join(', ')}
                  </div>

                  {entry.candidates.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-slate-400">
                        Aday Kanıtlar (sorgu/okuma anına aittir):
                      </div>
                      {entry.candidates.map((cand) => {
                        const isChosen = entry.selectedCandidateId === cand.id;
                        return (
                          <div
                            key={cand.id}
                            className={`rounded border p-1.5 text-[11px] ${
                              isChosen
                                ? 'border-sky-500/60 bg-sky-950/30'
                                : 'border-slate-800 bg-slate-950/70'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <a
                                href={cand.url}
                                target="_blank"
                                rel="noreferrer"
                                className="line-clamp-2 text-slate-200 hover:text-sky-300"
                              >
                                {cand.title}
                              </a>
                              <span className="shrink-0 font-semibold text-slate-100">
                                {cand.unitPrice !== null
                                  ? `${cand.unitPrice.toFixed(2)} ${cand.currency}`
                                  : '—'}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                {cand.store} · {cand.stockStatus} ·{' '}
                                {new Date(cand.observedAt).toLocaleTimeString('tr-TR')}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => selectCandidate(entry.id, cand.id, false)}
                                  className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
                                >
                                  Seç
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectCandidate(entry.id, cand.id, true)}
                                  title="Kullanıcı onayıyla kesin eşleşme (exact) olarak kilitle"
                                  className="inline-flex items-center gap-0.5 rounded bg-emerald-700/80 px-1.5 py-0.5 text-white hover:bg-emerald-600"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Onayla
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visibleItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
            Gösterilecek BOM kalemi yok.
          </div>
        )}
      </div>
    </div>
  );
}
