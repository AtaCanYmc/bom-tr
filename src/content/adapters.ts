import type { PageCaptureResult, StockStatus } from '../shared/bom';
import { STORES, type StoreId } from '../shared/stores';
import { inferStockFromText, parseTurkishPrice, readJsonLdProduct } from './parser';

export interface StoreDomAdapter {
  storeId: StoreId;
  titleSelectors: string[];
  priceSelectors: string[];
  stockSelectors: string[];
  skuSelectors: string[];
}

// Each store adapter isolates its CSS selectors; missing matches yield partial flags, never guesses.
const STORE_ADAPTERS: Record<StoreId, StoreDomAdapter> = {
  robotistan: {
    storeId: 'robotistan',
    titleSelectors: ['h1#product-title', 'h1.product-name', 'h1'],
    priceSelectors: ['.product-price', '.product-current-price', '[itemprop="price"]'],
    stockSelectors: ['#addToCartBtn', '.add-to-cart-button', '.out-of-stock', '.stock-status'],
    skuSelectors: ['.product-code', '[itemprop="sku"]'],
  },
  robolink: {
    storeId: 'robolink',
    titleSelectors: ['h1.product-title', 'h1#productName', 'h1'],
    priceSelectors: ['.product-price', '.product-price-not-discounted', '[itemprop="price"]'],
    stockSelectors: ['#addCartBtn', '.add-to-cart', '.out-of-stock-text'],
    skuSelectors: ['.product-sku', '[itemprop="sku"]'],
  },
  robo90: {
    storeId: 'robo90',
    titleSelectors: ['h1.product-name', 'h1.product-title', 'h1'],
    priceSelectors: ['.product-price', '.current-price', '[itemprop="price"]'],
    stockSelectors: ['.add-to-cart', '#addCartBtn', '.stock-warning'],
    skuSelectors: ['.product-code', '[itemprop="sku"]'],
  },
  direncnet: {
    storeId: 'direncnet',
    titleSelectors: ['h1#productName', 'h1.product-name', 'h1'],
    priceSelectors: ['.product-price', '.product-price-kdvsiz', '[itemprop="price"]'],
    stockSelectors: ['#addCartBtn', '.add-to-cart', '.out-of-stock'],
    skuSelectors: ['.product-code', '#productCode', '[itemprop="sku"]'],
  },
  motorobit: {
    storeId: 'motorobit',
    titleSelectors: ['h1.product-title', 'h1.product-name', 'h1'],
    priceSelectors: ['.product-price', '.price-sales', '[itemprop="price"]'],
    stockSelectors: ['#addToCartBtn', '.add-to-cart', '.stock-out'],
    skuSelectors: ['.product-code', '[itemprop="sku"]'],
  },
  robotsepeti: {
    storeId: 'robotsepeti',
    titleSelectors: ['h1.product-title', 'h1#productName', 'h1'],
    priceSelectors: ['.product-price', '.indirimli-fiyat', '[itemprop="price"]'],
    stockSelectors: ['#addCartBtn', '.sepete-ekle', '.tukendi'],
    skuSelectors: ['.product-code', '[itemprop="sku"]'],
  },
};

function firstSelectorText(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (!el) continue;
    const contentAttr = el.getAttribute('content');
    const text = (contentAttr ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return null;
}

export function extractStoreProduct(
  doc: Document,
  url: string,
  storeId: StoreId,
): PageCaptureResult {
  const adapter = STORE_ADAPTERS[storeId];
  const store = STORES[storeId];
  const observedAt = new Date().toISOString();
  const ld = readJsonLdProduct(doc);

  const title =
    ld?.title ??
    firstSelectorText(doc, adapter.titleSelectors) ??
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ??
    null;

  const rawPriceText =
    firstSelectorText(doc, adapter.priceSelectors) ??
    doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content')?.trim() ??
    null;

  const price = ld?.price ?? parseTurkishPrice(rawPriceText);
  const currency =
    ld?.currency ??
    doc.querySelector('meta[property="product:price:currency"]')?.getAttribute('content')?.trim() ??
    'TRY';

  const stockSignal = firstSelectorText(doc, adapter.stockSelectors);
  const stockStatus: StockStatus =
    ld?.stockStatus && ld.stockStatus !== 'unknown'
      ? ld.stockStatus
      : inferStockFromText(stockSignal);

  const sku = ld?.sku ?? firstSelectorText(doc, adapter.skuSelectors);

  const missingFields: string[] = [];
  if (!title) missingFields.push('title');
  if (price === null) missingFields.push('price');
  if (stockStatus === 'unknown') missingFields.push('stockStatus');

  return {
    supported: true,
    storeId,
    storeName: store.name,
    url,
    title,
    price,
    currency,
    formattedPrice: price !== null ? `${price.toFixed(2)} ${currency}` : rawPriceText,
    stockStatus,
    sku,
    observedAt,
    partial: missingFields.length > 0,
    missingFields,
    warning:
      missingFields.length > 0
        ? `Eksik alanlar (${missingFields.join(', ')}); ürün sayfasında olduğundan emin olun.`
        : undefined,
  };
}
