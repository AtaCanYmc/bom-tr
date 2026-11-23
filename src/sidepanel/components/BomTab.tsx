import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  Lock,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import {
  BOM_STATUSES,
  MATCH_CONFIDENCES,
  STOCK_STATUSES,
  createEmptyBomItem,
  createSampleBomItems,
  type BomStatus,
  type MatchConfidence,
  type StockStatus,
  type WorkspaceBomItem,
} from '../../shared/bom';
import { t } from '../../shared/i18n';
import { buildFallbackSearchUrls, sanitizeHttpUrl } from '../../shared/stores';
import { sendBackgroundMessage } from '../chromeBridge';
import { useWorkspaceStore } from '../store';

function getStatusStyle(status: BomStatus): React.CSSProperties {
  if (status === 'confirmed') {
    return {
      color: 'var(--status-ok)',
      backgroundColor: 'var(--status-ok-bg)',
      borderColor: 'var(--status-ok-border)',
    };
  }
  if (status === 'inferred_required') {
    return {
      color: 'var(--status-warn)',
      backgroundColor: 'var(--status-warn-bg)',
      borderColor: 'var(--status-warn-border)',
    };
  }
  return {
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-subtle)',
    borderColor: 'var(--border-subtle)',
  };
}

function getConfidenceStyle(confidence: MatchConfidence): React.CSSProperties {
  if (confidence === 'exact') {
    return {
      color: 'var(--status-ok)',
      backgroundColor: 'var(--status-ok-bg)',
      borderColor: 'var(--status-ok-border)',
    };
  }
  if (confidence === 'partial') {
    return {
      color: 'var(--status-warn)',
      backgroundColor: 'var(--status-warn-bg)',
      borderColor: 'var(--status-warn-border)',
    };
  }
  if (confidence === 'ambiguous') {
    return {
      color: 'var(--status-err)',
      backgroundColor: 'var(--status-err-bg)',
      borderColor: 'var(--status-err-border)',
    };
  }
  return {
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-input)',
    borderColor: 'var(--border-subtle)',
  };
}

function getStockColor(stock: StockStatus): string {
  if (stock === 'in_stock') return 'var(--status-ok)';
  if (stock === 'low_stock') return 'var(--status-warn)';
  if (stock === 'out_of_stock') return 'var(--status-err)';
  return 'var(--text-muted)';
}

export function BomTab() {
  const {
    projects,
    activeProjectId,
    settings,
    addItem,
    importItems,
    updateItemBom,
    removeItem,
    attachCandidates,
    selectCandidate,
    setNotice,
  } = useWorkspaceStore();

  const [onlyAttention, setOnlyAttention] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const project = projects.find((p) => p.id === activeProjectId);
  if (!project) return null;

  const loc = settings.locale;

  const isAttention = (item: WorkspaceBomItem) =>
    item.bom.status === 'inferred_required' || item.bom.match_confidence === 'ambiguous';

  const attentionCount = project.items.filter(isAttention).length;
  const lockedCount = project.items.filter((i) => i.selectionLocked).length;

  const queryNorm = filterText.trim().toLowerCase();
  const visibleItems = [...project.items]
    .filter((item) => (!onlyAttention ? true : isAttention(item)))
    .filter((item) => {
      if (!queryNorm) return true;
      return (
        item.bom.canonical_name.toLowerCase().includes(queryNorm) ||
        item.bom.raw_name.toLowerCase().includes(queryNorm) ||
        item.bom.notes.toLowerCase().includes(queryNorm)
      );
    })
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
          aria-label={t(loc, 'addPartPlaceholder')}
          placeholder={t(loc, 'addPartPlaceholder')}
          className="wb-input flex-1 px-2.5 py-2 text-xs"
        />
        <button
          type="submit"
          disabled={!newPartName.trim()}
          className="wb-btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t(loc, 'add')}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <span>
            <strong className="font-mono-tech tabular-nums text-[var(--text-primary)]">
              {project.items.length}
            </strong>{' '}
            {t(loc, 'itemsUnit')}
          </span>
          <span aria-hidden="true">/</span>
          <span>
            <strong className="font-mono-tech tabular-nums text-[var(--status-ok)]">
              {lockedCount}
            </strong>{' '}
            {t(loc, 'approvedUnit')}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOnlyAttention((v) => !v)}
          aria-pressed={onlyAttention}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors"
          style={
            onlyAttention
              ? {
                  borderColor: 'var(--status-warn-border)',
                  backgroundColor: 'var(--status-warn-bg)',
                  color: 'var(--status-warn)',
                }
              : {
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-secondary)',
                }
          }
        >
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {t(loc, 'reviewFilter')} (<span className="font-mono-tech tabular-nums">{attentionCount}</span>)
        </button>
      </div>

      {project.items.length > 3 && (
        <div className="relative">
          <Filter
            className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label={t(loc, 'filterPlaceholder')}
            placeholder={t(loc, 'filterPlaceholder')}
            className="wb-input w-full py-1.5 pl-7 pr-2.5 text-[11px]"
          />
        </div>
      )}

      <div className="space-y-2">
        {visibleItems.map((entry) => {
          const { bom } = entry;
          const highlighted = isAttention(entry);
          const expanded = expandedId === entry.id;
          const selected = entry.candidates.find((c) => c.id === entry.selectedCandidateId);

          return (
            <article
              key={entry.id}
              className="wb-card p-3 text-xs transition-colors"
              style={
                highlighted
                  ? {
                      borderColor: 'var(--status-warn-border)',
                    }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                    aria-expanded={expanded}
                    className="text-left text-[13px] font-semibold leading-snug text-[var(--text-primary)] hover:text-[var(--accent)]"
                  >
                    {bom.canonical_name}
                  </button>
                  <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    {t(loc, 'rawPrefix')}: {bom.raw_name}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
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
                    aria-label={`${bom.canonical_name} adedi`}
                    title="Adet (boş = null)"
                    className="wb-input font-mono-tech tabular-nums w-12 px-1.5 py-1 text-center text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(entry.id)}
                    aria-label={`${bom.canonical_name} kalemini sil`}
                    title="Kalemi sil"
                    className="wb-btn-ghost p-1.5 hover:text-[var(--status-err)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span
                  className="font-mono-tech rounded-[var(--radius-sm)] border px-1.5 py-0.5"
                  style={getStatusStyle(bom.status)}
                >
                  {bom.status}
                </span>
                <span
                  className="font-mono-tech rounded-[var(--radius-sm)] border px-1.5 py-0.5"
                  style={getConfidenceStyle(bom.match_confidence)}
                >
                  {bom.match_confidence}
                </span>
                <span
                  className="font-mono-tech px-0.5 font-medium"
                  style={{ color: getStockColor(bom.stock_status) }}
                >
                  {bom.stock_status}
                </span>
                {entry.selectionLocked && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-medium"
                    style={{
                      color: 'var(--status-ok)',
                      backgroundColor: 'var(--status-ok-bg)',
                      borderColor: 'var(--status-ok-border)',
                    }}
                  >
                    <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                    {t(loc, 'approvedBadge')}
                  </span>
                )}
              </div>

              {selected && (
                <div className="wb-inset mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]">
                  <span className="truncate text-[var(--text-secondary)]">
                    <span className="font-mono-tech">{selected.store}</span>:{' '}
                    <strong className="font-mono-tech tabular-nums text-[var(--text-primary)]">
                      {selected.unitPrice !== null
                        ? `${selected.unitPrice.toFixed(2)} ${selected.currency}`
                        : t(loc, 'noPrice')}
                    </strong>
                  </span>
                  {sanitizeHttpUrl(selected.url) && (
                    <a
                      href={sanitizeHttpUrl(selected.url)!}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${selected.title}`}
                      className="shrink-0 text-[var(--accent)] hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={searchingId === entry.id}
                  onClick={() => void handleApiSearch(entry)}
                  className="wb-btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                >
                  <Search className="h-3 w-3" aria-hidden="true" />
                  {searchingId === entry.id ? t(loc, 'searching') : t(loc, 'apiSearch')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenFallbackTabs(bom.search_queries[0] || bom.canonical_name)
                  }
                  className="wb-btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  {t(loc, 'storesFallback')}
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                  aria-expanded={expanded}
                  className="wb-btn-ghost ml-auto inline-flex items-center gap-0.5 px-1.5 py-1 text-[11px]"
                >
                  <span>
                    {expanded ? t(loc, 'hide') : `${t(loc, 'details')} (${entry.candidates.length})`}
                  </span>
                  {expanded ? (
                    <ChevronUp className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  )}
                </button>
              </div>

              {expanded && (
                <div className="mt-3 space-y-2.5 border-t border-[var(--border-subtle)] pt-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="space-y-1">
                      <span className="block text-[10px] text-[var(--text-muted)]">
                        {t(loc, 'statusLabel')}
                      </span>
                      <select
                        value={bom.status}
                        onChange={(e) =>
                          updateItemBom(entry.id, { status: e.target.value as BomStatus })
                        }
                        className="wb-input w-full px-1.5 py-1 text-[11px]"
                      >
                        {BOM_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[10px] text-[var(--text-muted)]">Güven</span>
                      <select
                        value={bom.match_confidence}
                        onChange={(e) =>
                          updateItemBom(entry.id, {
                            match_confidence: e.target.value as MatchConfidence,
                          })
                        }
                        className="wb-input w-full px-1.5 py-1 text-[11px]"
                      >
                        {MATCH_CONFIDENCES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[10px] text-[var(--text-muted)]">Stok</span>
                      <select
                        value={bom.stock_status}
                        onChange={(e) =>
                          updateItemBom(entry.id, {
                            stock_status: e.target.value as StockStatus,
                          })
                        }
                        className="wb-input w-full px-1.5 py-1 text-[11px]"
                      >
                        {STOCK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="block text-[10px] text-[var(--text-muted)]">
                      Teknik Notlar ve Çakışmalar
                    </span>
                    <textarea
                      rows={2}
                      value={bom.notes}
                      onChange={(e) => updateItemBom(entry.id, { notes: e.target.value })}
                      placeholder="Voltaj, kılıf veya pin dizilimi notu ekleyin..."
                      className="wb-input w-full p-2 text-[11px]"
                    />
                  </label>

                  <div className="font-mono-tech text-[10px] text-[var(--text-muted)]">
                    Kaynaklar: {bom.source_files.join(', ')}
                  </div>

                  {entry.candidates.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-medium text-[var(--text-secondary)]">
                        Aday Kanıtlar (sorgu anına aittir)
                      </div>
                      {entry.candidates.map((cand) => {
                        const isChosen = entry.selectedCandidateId === cand.id;
                        return (
                          <div
                            key={cand.id}
                            className="wb-inset p-2 text-[11px]"
                            style={
                              isChosen
                                ? {
                                    borderColor: 'var(--accent)',
                                    backgroundColor: 'var(--accent-soft)',
                                  }
                                : undefined
                            }
                          >
                            <div className="flex items-start justify-between gap-2">
                              {sanitizeHttpUrl(cand.url) ? (
                                <a
                                  href={sanitizeHttpUrl(cand.url)!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="line-clamp-2 font-medium text-[var(--text-primary)] hover:text-[var(--accent)]"
                                >
                                  {cand.title}
                                </a>
                              ) : (
                                <span className="line-clamp-2 font-medium text-[var(--text-primary)]">
                                  {cand.title}
                                </span>
                              )}
                              <span className="font-mono-tech tabular-nums shrink-0 font-semibold text-[var(--text-primary)]">
                                {cand.unitPrice !== null
                                  ? `${cand.unitPrice.toFixed(2)} ${cand.currency}`
                                  : 'Fiyat yok'}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]">
                              <span className="font-mono-tech tabular-nums truncate">
                                {cand.store} / {cand.stockStatus} /{' '}
                                {new Date(cand.observedAt).toLocaleTimeString('tr-TR')}
                              </span>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => selectCandidate(entry.id, cand.id, false)}
                                  className="wb-btn-secondary px-2 py-0.5 text-[10px]"
                                >
                                  Seç
                                </button>
                                <button
                                  type="button"
                                  onClick={() => selectCandidate(entry.id, cand.id, true)}
                                  title="Kullanıcı onayıyla kesin eşleşme (exact) olarak kilitle"
                                  className="inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                                  style={{
                                    borderColor: 'var(--status-ok-border)',
                                    backgroundColor: 'var(--status-ok-bg)',
                                    color: 'var(--status-ok)',
                                  }}
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
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
            </article>
          );
        })}

        {visibleItems.length === 0 && (
          <div className="wb-card border-dashed p-5 text-center">
            <p className="text-xs font-medium text-[var(--text-primary)]">
              {onlyAttention || queryNorm
                ? t(loc, 'emptyFilteredTitle')
                : t(loc, 'emptyProjectTitle')}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {onlyAttention || queryNorm
                ? t(loc, 'emptyFilteredBody')
                : t(loc, 'emptyProjectBody')}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              {onlyAttention || queryNorm ? (
                <button
                  type="button"
                  onClick={() => {
                    setOnlyAttention(false);
                    setFilterText('');
                  }}
                  className="wb-btn-secondary px-3 py-1.5 text-[11px]"
                >
                  {t(loc, 'clearFilter')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => importItems(createSampleBomItems(), 'replace')}
                  className="wb-btn-secondary px-3 py-1.5 text-[11px]"
                >
                  {t(loc, 'loadSampleBom')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
