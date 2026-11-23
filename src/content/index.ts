import type { ContentRequest, ContentResponse } from '../shared/messages';
import { detectStoreFromUrl } from '../shared/stores';
import { extractStoreProduct } from './adapters';

chrome.runtime.onMessage.addListener((message: ContentRequest, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (message.type !== 'READ_PRODUCT_PAGE') return false;

  const store = detectStoreFromUrl(window.location.href);
  if (!store) {
    sendResponse({
      ok: false,
      error: 'Bu alan adı desteklenen 6 mağaza listesinde değil.',
    } satisfies ContentResponse);
    return false;
  }

  try {
    const capture = extractStoreProduct(document, window.location.href, store.id);
    sendResponse({ ok: true, capture } satisfies ContentResponse);
  } catch (err) {
    sendResponse({
      ok: false,
      error: err instanceof Error ? err.message : 'DOM okuma hatası',
    } satisfies ContentResponse);
  }
  return false;
});
