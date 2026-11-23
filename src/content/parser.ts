import type { StockStatus } from '../shared/bom';

export function parseTurkishPrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\d.,]/g, '')
    .trim();
  if (!cleaned) return null;

  // Handle "1.250,90" (TR locale) vs "1250.90" (ISO/JSON-LD).
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  let normalized = cleaned;
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    const parts = cleaned.split(',');
    const frac = parts[parts.length - 1] ?? '';
    normalized = frac.length === 2 || frac.length === 1 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function inferStockFromText(raw: string | null | undefined): StockStatus {
  if (!raw) return 'unknown';
  const text = raw.toLowerCase();
  if (
    text.includes('outofstock') ||
    text.includes('tükendi') ||
    text.includes('stokta yok') ||
    text.includes('stok yok') ||
    text.includes('temin edilemiyor')
  ) {
    return 'out_of_stock';
  }
  if (text.includes('limitedavailability') || text.includes('son ') || text.includes('az kaldı')) {
    return 'low_stock';
  }
  if (
    text.includes('instock') ||
    text.includes('stokta') ||
    text.includes('sepete ekle') ||
    text.includes('hemen al')
  ) {
    return 'in_stock';
  }
  return 'unknown';
}

export interface JsonLdProduct {
  title: string | null;
  price: number | null;
  currency: string | null;
  stockStatus: StockStatus;
  sku: string | null;
}

function findProductNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findProductNode(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object' || node === null) return null;

  const obj = node as Record<string, unknown>;
  const typeField = obj['@type'];
  const isProduct =
    typeField === 'Product' ||
    (Array.isArray(typeField) && typeField.includes('Product'));
  if (isProduct) return obj;

  if (Array.isArray(obj['@graph'])) {
    return findProductNode(obj['@graph']);
  }
  return null;
}

export function readJsonLdProduct(doc: Document): JsonLdProduct | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const product = findProductNode(parsed);
      if (!product) continue;

      const offersRaw = product.offers;
      const offer = (
        Array.isArray(offersRaw) ? offersRaw[0] : offersRaw
      ) as Record<string, unknown> | undefined;

      const rawPrice = offer?.price ?? offer?.lowPrice;
      const price =
        typeof rawPrice === 'number'
          ? rawPrice
          : typeof rawPrice === 'string'
            ? parseTurkishPrice(rawPrice)
            : null;

      return {
        title: typeof product.name === 'string' ? product.name.trim() : null,
        price,
        currency: typeof offer?.priceCurrency === 'string' ? offer.priceCurrency : null,
        stockStatus: inferStockFromText(
          typeof offer?.availability === 'string' ? offer.availability : null,
        ),
        sku: typeof product.sku === 'string' ? product.sku.trim() : null,
      };
    } catch {
      // Ignore malformed JSON-LD blocks on store pages.
    }
  }
  return null;
}
