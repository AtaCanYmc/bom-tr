import type { PageCaptureResult } from '../shared/bom';
import type { BackgroundRequest, BackgroundResponse, ContentResponse } from '../shared/messages';
import { detectStoreFromUrl } from '../shared/stores';
import { checkApiHealth, optimizeCart, searchComponent } from './roboApi';
import { PENDING_CONTEXT_ITEM_KEY } from './storageKeys';

const CONTEXT_MENU_ID = 'bomtr-add-to-bom';
const MAX_BATCH_TABS = 12;

async function setupExtension(): Promise<void> {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "bomTR: BOM'a Ekle",
    contexts: ['selection', 'page'],
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void setupExtension();
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function flashBadge(text: string, color: string): Promise<void> {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
}

async function captureTabProduct(tabId: number, tabUrl?: string): Promise<PageCaptureResult> {
  const url = tabUrl ?? '';
  const store = detectStoreFromUrl(url);
  if (!store) {
    return {
      supported: false,
      storeId: null,
      storeName: null,
      url,
      title: null,
      price: null,
      currency: 'TRY',
      formattedPrice: null,
      stockStatus: 'unknown',
      sku: null,
      observedAt: new Date().toISOString(),
      partial: true,
      missingFields: ['store'],
      warning: 'Aktif sekme desteklenen 6 elektronik mağazasından biri değil.',
    };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tabId, {
      type: 'READ_PRODUCT_PAGE',
    })) as ContentResponse | undefined;
    if (response?.ok) {
      return response.capture;
    }
    return {
      supported: true,
      storeId: store.id,
      storeName: store.name,
      url,
      title: null,
      price: null,
      currency: 'TRY',
      formattedPrice: null,
      stockStatus: 'unknown',
      sku: null,
      observedAt: new Date().toISOString(),
      partial: true,
      missingFields: ['title', 'price', 'stockStatus'],
      warning: response?.error ?? 'Sayfa DOM okuyucusu yanıt vermedi; sekmeyi yenileyip tekrar deneyin.',
    };
  } catch {
    return {
      supported: true,
      storeId: store.id,
      storeName: store.name,
      url,
      title: null,
      price: null,
      currency: 'TRY',
      formattedPrice: null,
      stockStatus: 'unknown',
      sku: null,
      observedAt: new Date().toISOString(),
      partial: true,
      missingFields: ['title', 'price', 'stockStatus'],
      warning: 'Content script henüz sayfaya yüklenmemiş; sayfayı yenileyin.',
    };
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const selectedText = info.selectionText?.trim() ?? '';
  let payload: {
    id: string;
    kind: 'selection' | 'page';
    text?: string;
    capture?: PageCaptureResult;
    createdAt: string;
  };

  if (selectedText) {
    payload = {
      id: crypto.randomUUID(),
      kind: 'selection',
      text: selectedText,
      createdAt: new Date().toISOString(),
    };
  } else if (tab?.id !== undefined) {
    const capture = await captureTabProduct(tab.id, tab.url);
    payload = {
      id: crypto.randomUUID(),
      kind: 'page',
      capture,
      createdAt: new Date().toISOString(),
    };
  } else {
    return;
  }

  await chrome.storage.local.set({ [PENDING_CONTEXT_ITEM_KEY]: payload });
  await flashBadge('+1', '#10b981');

  if (tab?.windowId !== undefined) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch {
      // Side panel may already be open or blocked by browser context.
    }
  }
});

async function openTabsStaggered(urls: string[], delayMs = 350): Promise<number> {
  const safeUrls = urls
    .filter((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    })
    .slice(0, MAX_BATCH_TABS);

  const clampedDelay = Math.max(150, Math.min(2000, delayMs));
  let opened = 0;

  for (let i = 0; i < safeUrls.length; i++) {
    const url = safeUrls[i];
    if (!url) continue;
    await chrome.tabs.create({ url, active: i === 0 });
    opened += 1;
    if (i < safeUrls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, clampedDelay));
    }
  }
  return opened;
}

async function handleMessage(message: BackgroundRequest): Promise<BackgroundResponse> {
  switch (message.type) {
    case 'CHECK_API_HEALTH': {
      const health = await checkApiHealth(message.apiBaseUrl);
      return { ok: true, health };
    }
    case 'SEARCH_COMPONENT': {
      const { candidates, observedAt } = await searchComponent(
        message.apiBaseUrl,
        message.query,
        message.limit,
      );
      return { ok: true, candidates, observedAt };
    }
    case 'OPTIMIZE_CART': {
      const optimization = await optimizeCart(
        message.apiBaseUrl,
        message.items,
        message.localCandidatesByQuery,
        message.overrides,
      );
      return { ok: true, optimization };
    }
    case 'CAPTURE_ACTIVE_TAB': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return { ok: false, error: 'Aktif tarayıcı sekmesi bulunamadı.' };
      }
      const capture = await captureTabProduct(tab.id, tab.url);
      return { ok: true, capture };
    }
    case 'OPEN_TABS_STAGGERED': {
      const openedCount = await openTabsStaggered(message.urls, message.delayMs);
      return { ok: true, openedCount };
    }
    case 'UPDATE_BADGE': {
      const text = message.count > 0 ? String(Math.min(99, message.count)) : '';
      const color = message.attentionCount > 0 ? '#d97706' : '#0f766e';
      await chrome.action.setBadgeBackgroundColor({ color });
      await chrome.action.setBadgeText({ text });
      return { ok: true };
    }
  }
}

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  void (async () => {
    try {
      const result = await handleMessage(message);
      sendResponse(result);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Bilinmeyen arka plan hatası';
      const offline =
        err instanceof TypeError || text.includes('Failed to fetch') || text.includes('AbortError');
      sendResponse({ ok: false, error: text, offline } satisfies BackgroundResponse);
    }
  })();
  return true;
});
