import type {
  ApiHealthStatus,
  CandidateEvidence,
  CartOptimizationResult,
  CartScenario,
  StockStatus,
  StoreCartBreakdown,
} from '../shared/bom';
import { STORES, normalizeStoreId } from '../shared/stores.ts';

const REQUEST_TIMEOUT_MS = 12_000;
const HEALTH_TIMEOUT_MS = 4_000;

export function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Yalnızca http:// veya https:// API adresleri desteklenir.');
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function mapProductToCandidate(raw: Record<string, unknown>, observedAt: string): CandidateEvidence | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!title || !url) return null;

  const storeRaw = typeof raw.store === 'string' ? raw.store : 'unknown';
  const normalizedStore = normalizeStoreId(storeRaw) ?? storeRaw;
  const price =
    typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : null;
  const stockStatus: StockStatus =
    typeof raw.in_stock === 'boolean' ? (raw.in_stock ? 'in_stock' : 'out_of_stock') : 'unknown';

  return {
    id: `${normalizedStore}:${url}`,
    store: normalizedStore,
    title,
    unitPrice: price,
    currency: typeof raw.currency === 'string' ? raw.currency : 'TRY',
    formattedPrice: typeof raw.formatted_price === 'string' ? raw.formatted_price : undefined,
    url,
    stockStatus,
    sku: typeof raw.sku === 'string' ? raw.sku : undefined,
    observedAt,
    source: 'robo-api',
    verifiedByUser: false,
  };
}

export async function checkApiHealth(apiBaseUrl: string): Promise<ApiHealthStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const base = normalizeBaseUrl(apiBaseUrl);
    for (const path of ['/api/v1/health', '/health']) {
      const { status, data } = await fetchJsonWithTimeout(
        `${base}${path}`,
        { method: 'GET' },
        HEALTH_TIMEOUT_MS,
      );
      if (status >= 200 && status < 300) {
        const obj = (data ?? {}) as Record<string, unknown>;
        return {
          online: true,
          version: typeof obj.version === 'string' ? obj.version : undefined,
          checkedAt,
        };
      }
    }
    return { online: false, checkedAt, error: 'Sağlık ucu 2xx yanıtı vermedi.' };
  } catch (err) {
    return {
      online: false,
      checkedAt,
      error: err instanceof Error ? err.message : 'API erişilemiyor',
    };
  }
}

export async function searchComponent(
  apiBaseUrl: string,
  rawQuery: string,
  limit = 6,
): Promise<{ candidates: CandidateEvidence[]; observedAt: string }> {
  const query = rawQuery.trim();
  if (!query) {
    throw new Error('Arama terimi boş olamaz.');
  }

  const base = normalizeBaseUrl(apiBaseUrl);
  const observedAt = new Date().toISOString();

  // Primary endpoint in robo-market-search >=1.10; falls back to GET /api/v1/search?q=.
  let res = await fetchJsonWithTimeout(
    `${base}/api/v1/search`,
    {
      method: 'POST',
      body: JSON.stringify({
        query,
        limit,
        sort_by_price: true,
        use_cache: true,
        expand_synonyms: true,
      }),
    },
    REQUEST_TIMEOUT_MS,
  );

  if (res.status === 404 || res.status === 405) {
    res = await fetchJsonWithTimeout(
      `${base}/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
  }

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Arama API hatası (HTTP ${res.status})`);
  }

  const payload = (res.data ?? {}) as Record<string, unknown>;
  const rawList = Array.isArray(payload.products)
    ? payload.products
    : Array.isArray(payload.results)
      ? payload.results
      : Array.isArray(res.data)
        ? res.data
        : [];

  const candidates = rawList
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => mapProductToCandidate(item, observedAt))
    .filter((item): item is CandidateEvidence => item !== null);

  return { candidates, observedAt };
}

export interface CartPricingOverrides {
  currency?: string;
  freeShippingThreshold?: number | null;
}

function shippingForStore(
  storeKey: string,
  subtotal: number,
  thresholdOverride?: number | null,
): {
  fee: number;
  threshold: number | null;
} {
  const normalized = normalizeStoreId(storeKey);
  const baseFee = normalized ? STORES[normalized].defaultShippingTry : 39.9;
  const defaultThreshold = normalized ? STORES[normalized].defaultFreeShippingMinTry : 1500;
  const threshold =
    typeof thresholdOverride === 'number' && Number.isFinite(thresholdOverride) && thresholdOverride >= 0
      ? thresholdOverride
      : defaultThreshold;
  const fee = subtotal >= threshold ? 0 : baseFee;
  return { fee, threshold };
}

// Evaluates single-store vs greedy split-store totals across observed candidates.
// ponytail: greedy per-item split without full combinatorial search; exact DP if >15 stores added.
export function computeCartScenarios(
  items: Array<{ query: string; quantity: number }>,
  candidatesByQuery: Record<string, CandidateEvidence[]>,
  overrides?: CartPricingOverrides,
): { singleStore: CartScenario | null; splitStore: CartScenario | null } {
  const requestedCount = items.length;
  if (requestedCount === 0) return { singleStore: null, splitStore: null };
  const currency = overrides?.currency?.trim() || 'TRY';
  const thresholdOverride = overrides?.freeShippingThreshold;

  const storeIds = new Set<string>();
  for (const list of Object.values(candidatesByQuery)) {
    for (const c of list) {
      if (c.unitPrice !== null && c.stockStatus !== 'out_of_stock') {
        storeIds.add(String(c.store));
      }
    }
  }

  const assumptions = [
    'Fiyat ve stoklar yalnızca sorgu anına ait kanıttır; sipariş öncesi mağaza sayfasında doğrulanmalıdır.',
    'Kargo ücretleri ve 1500 TL ücretsiz kargo eşiği varsayılan tahminlerdir.',
  ];

  // Single-store comparison
  let bestSingle: CartScenario | null = null;
  for (const store of storeIds) {
    const matchedLines: StoreCartBreakdown['items'] = [];
    const missing: string[] = [];

    for (const req of items) {
      const list = (candidatesByQuery[req.query] ?? []).filter(
        (c) => String(c.store) === store && c.unitPrice !== null && c.stockStatus !== 'out_of_stock',
      );
      list.sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity));
      const best = list[0];
      if (!best || best.unitPrice === null) {
        missing.push(req.query);
      } else {
        matchedLines.push({
          query: req.query,
          title: best.title,
          quantity: req.quantity,
          unitPrice: best.unitPrice,
          lineTotal: best.unitPrice * req.quantity,
          url: best.url,
          stockStatus: best.stockStatus,
        });
      }
    }

    if (matchedLines.length === 0) continue;
    const subtotal = matchedLines.reduce((sum, l) => sum + l.lineTotal, 0);
    const { fee, threshold } = shippingForStore(store, subtotal, thresholdOverride);
    const scenario: CartScenario = {
      kind: 'single_store',
      label: `Tek Mağaza (${store})`,
      stores: [
        {
          store,
          subtotal,
          shippingFee: fee,
          freeShippingThreshold: threshold,
          total: subtotal + fee,
          items: matchedLines,
        },
      ],
      itemsSubtotal: subtotal,
      shippingTotal: fee,
      grandTotal: subtotal + fee,
      currency,
      coverageCount: matchedLines.length,
      requestedCount,
      missingItems: missing,
      assumptions,
    };

    if (
      !bestSingle ||
      scenario.coverageCount > bestSingle.coverageCount ||
      (scenario.coverageCount === bestSingle.coverageCount &&
        scenario.grandTotal < bestSingle.grandTotal)
    ) {
      bestSingle = scenario;
    }
  }

  // Split-store comparison (lowest observed unit price per item across all stores)
  const grouped = new Map<string, StoreCartBreakdown['items']>();
  const splitMissing: string[] = [];

  for (const req of items) {
    const valid = (candidatesByQuery[req.query] ?? []).filter(
      (c) => c.unitPrice !== null && c.stockStatus !== 'out_of_stock',
    );
    valid.sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity));
    const best = valid[0];
    if (!best || best.unitPrice === null) {
      splitMissing.push(req.query);
      continue;
    }
    const storeKey = String(best.store);
    const bucket = grouped.get(storeKey) ?? [];
    bucket.push({
      query: req.query,
      title: best.title,
      quantity: req.quantity,
      unitPrice: best.unitPrice,
      lineTotal: best.unitPrice * req.quantity,
      url: best.url,
      stockStatus: best.stockStatus,
    });
    grouped.set(storeKey, bucket);
  }

  let splitStore: CartScenario | null = null;
  if (grouped.size > 0) {
    const stores: StoreCartBreakdown[] = [];
    for (const [store, lines] of grouped.entries()) {
      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const { fee, threshold } = shippingForStore(store, subtotal, thresholdOverride);
      stores.push({
        store,
        subtotal,
        shippingFee: fee,
        freeShippingThreshold: threshold,
        total: subtotal + fee,
        items: lines,
      });
    }
    const itemsSubtotal = stores.reduce((s, st) => s + st.subtotal, 0);
    const shippingTotal = stores.reduce((s, st) => s + st.shippingFee, 0);
    splitStore = {
      kind: 'split_store',
      label: `Bölünmüş Sepet (${stores.length} mağaza)`,
      stores,
      itemsSubtotal,
      shippingTotal,
      grandTotal: itemsSubtotal + shippingTotal,
      currency,
      coverageCount: requestedCount - splitMissing.length,
      requestedCount,
      missingItems: splitMissing,
      assumptions,
    };
  }

  return { singleStore: bestSingle, splitStore };
}

export async function optimizeCart(
  apiBaseUrl: string,
  items: Array<{ query: string; quantity: number }>,
  localCandidatesByQuery: Record<string, CandidateEvidence[]> = {},
  overrides?: CartPricingOverrides,
): Promise<CartOptimizationResult> {
  const observedAt = new Date().toISOString();
  const warnings: string[] = [];
  const cleanItems = items
    .map((item) => ({ query: item.query.trim(), quantity: Math.max(1, Math.floor(item.quantity)) }))
    .filter((item) => item.query.length > 0);

  if (cleanItems.length === 0) {
    throw new Error('Sepet optimizasyonu için en az 1 geçerli parça gerekli.');
  }

  const base = normalizeBaseUrl(apiBaseUrl);
  const queries = cleanItems.map((i) => i.query);
  const quantities = Object.fromEntries(cleanItems.map((i) => [i.query, i.quantity]));

  let rawSummary: string | undefined;
  let apiReachable = false;

  // Try documented /api/v1/cart/optimize first, then robo-api 1.10's /api/v1/optimize.
  for (const endpoint of ['/api/v1/cart/optimize', '/api/v1/optimize']) {
    try {
      const res = await fetchJsonWithTimeout(
        `${base}${endpoint}`,
        {
          method: 'POST',
          body: JSON.stringify({ items: queries, quantities }),
        },
        REQUEST_TIMEOUT_MS,
      );
      if (res.status >= 200 && res.status < 300) {
        apiReachable = true;
        const body = (res.data ?? {}) as Record<string, unknown>;
        const details = (body.details ?? {}) as Record<string, unknown>;
        if (typeof details.summary === 'string') {
          rawSummary = details.summary;
        }
        break;
      }
      if (res.status !== 404 && res.status !== 405) {
        warnings.push(`${endpoint} HTTP ${res.status} döndürdü.`);
      }
    } catch {
      // Fall through to next endpoint or local candidate evaluation.
    }
  }

  // Enrich candidates via /api/v1/search/batch when API is up so we always have per-store URLs and totals.
  const mergedCandidates: Record<string, CandidateEvidence[]> = { ...localCandidatesByQuery };
  try {
    const batchRes = await fetchJsonWithTimeout(
      `${base}/api/v1/search/batch`,
      {
        method: 'POST',
        body: JSON.stringify({ queries: queries.slice(0, 20), limit: 5 }),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (batchRes.status >= 200 && batchRes.status < 300) {
      apiReachable = true;
      const body = (batchRes.data ?? {}) as Record<string, unknown>;
      const resultsMap = (body.results ?? {}) as Record<string, unknown>;
      for (const [q, rawList] of Object.entries(resultsMap)) {
        if (!Array.isArray(rawList)) continue;
        const mapped = rawList
          .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
          .map((x) => mapProductToCandidate(x, observedAt))
          .filter((x): x is CandidateEvidence => x !== null);
        if (mapped.length > 0) {
          mergedCandidates[q] = mapped;
        }
      }
    }
  } catch {
    if (!apiReachable) {
      warnings.push('robo-api erişilemedi; mevcut yerel aday kanıtları üzerinden hesaplandı.');
    }
  }

  const { singleStore, splitStore } = computeCartScenarios(cleanItems, mergedCandidates, overrides);

  let winningLabel: string | null = null;
  if (singleStore && splitStore) {
    if (singleStore.coverageCount !== splitStore.coverageCount) {
      winningLabel =
        singleStore.coverageCount > splitStore.coverageCount
          ? `${singleStore.label} (daha yüksek kapsama)`
          : `${splitStore.label} (daha yüksek kapsama)`;
    } else {
      const winner = singleStore.grandTotal <= splitStore.grandTotal ? singleStore : splitStore;
      winningLabel = `${winner.label} — değerlendirilen adaylar arasında en düşük`;
    }
  } else if (singleStore) {
    winningLabel = `${singleStore.label} — değerlendirilen adaylar arasında en düşük`;
  } else if (splitStore) {
    winningLabel = `${splitStore.label} — değerlendirilen adaylar arasında en düşük`;
  } else {
    warnings.push('Kıyaslanabilir stoklu fiyat adayı bulunamadı.');
  }

  return {
    source: apiReachable ? 'robo-api' : 'local-candidates',
    observedAt,
    singleStore,
    splitStore,
    winningLabel,
    rawSummary,
    warnings,
  };
}
