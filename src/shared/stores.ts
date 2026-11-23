export type StoreId =
  | 'robotistan'
  | 'robolink'
  | 'robo90'
  | 'direncnet'
  | 'motorobit'
  | 'robotsepeti';

export interface StoreDefinition {
  id: StoreId;
  name: string;
  host: string;
  baseUrl: string;
  searchUrl: (query: string) => string;
  // Default shipping estimates; verify live store terms before checkout.
  defaultShippingTry: number;
  defaultFreeShippingMinTry: number;
}

export const STORES: Record<StoreId, StoreDefinition> = {
  robotistan: {
    id: 'robotistan',
    name: 'Robotistan',
    host: 'www.robotistan.com',
    baseUrl: 'https://www.robotistan.com',
    searchUrl: (q) => `https://www.robotistan.com/arama?q=${encodeURIComponent(q)}`,
    defaultShippingTry: 34.9,
    defaultFreeShippingMinTry: 1500,
  },
  robolink: {
    id: 'robolink',
    name: 'Robolink Market',
    host: 'www.robolinkmarket.com',
    baseUrl: 'https://www.robolinkmarket.com',
    searchUrl: (q) => `https://www.robolinkmarket.com/arama?q=${encodeURIComponent(q)}`,
    defaultShippingTry: 39.9,
    defaultFreeShippingMinTry: 1500,
  },
  robo90: {
    id: 'robo90',
    name: 'Robo90',
    host: 'www.robo90.com',
    baseUrl: 'https://www.robo90.com',
    searchUrl: (q) => `https://www.robo90.com/arama?q=${encodeURIComponent(q)}`,
    defaultShippingTry: 39.9,
    defaultFreeShippingMinTry: 1500,
  },
  direncnet: {
    id: 'direncnet',
    name: 'Direnç.net',
    host: 'www.direnc.net',
    baseUrl: 'https://www.direnc.net',
    searchUrl: (q) => `https://www.direnc.net/arama?q=${encodeURIComponent(q)}`,
    defaultShippingTry: 29.9,
    defaultFreeShippingMinTry: 1500,
  },
  motorobit: {
    id: 'motorobit',
    name: 'Motorobit',
    host: 'www.motorobit.com',
    baseUrl: 'https://www.motorobit.com',
    searchUrl: (q) => `https://www.motorobit.com/arama?q=${encodeURIComponent(q)}`,
    defaultShippingTry: 39.9,
    defaultFreeShippingMinTry: 1500,
  },
  robotsepeti: {
    id: 'robotsepeti',
    name: 'Robot Sepeti',
    host: 'www.robotsepeti.com',
    baseUrl: 'https://www.robotsepeti.com',
    searchUrl: (q) => `https://www.robotsepeti.com/arama?q=${encodeURIComponent(q)}`,
    defaultShippingTry: 39.9,
    defaultFreeShippingMinTry: 1500,
  },
};

export const STORE_LIST: StoreDefinition[] = Object.values(STORES);

const STORE_ALIAS_MAP: Record<string, StoreId> = {
  robotistan: 'robotistan',
  'robotistan.com': 'robotistan',
  robolink: 'robolink',
  'robolink market': 'robolink',
  robolinkmarket: 'robolink',
  robo90: 'robo90',
  direncnet: 'direncnet',
  'direnc.net': 'direncnet',
  'direnç.net': 'direncnet',
  motorobit: 'motorobit',
  robotsepeti: 'robotsepeti',
  'robot sepeti': 'robotsepeti',
};

export function normalizeStoreId(raw: string): StoreId | null {
  const key = raw.trim().toLowerCase();
  return STORE_ALIAS_MAP[key] ?? null;
}

export function detectStoreFromUrl(url: string): StoreDefinition | null {
  try {
    const { hostname } = new URL(url);
    const normalized = hostname.toLowerCase();
    return (
      STORE_LIST.find(
        (store) =>
          normalized === store.host || normalized === store.host.replace(/^www\./, ''),
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function buildFallbackSearchUrls(
  query: string,
  excludeStoreId?: StoreId,
): Array<{ store: StoreDefinition; url: string }> {
  const clean = query.trim();
  if (!clean) return [];
  return STORE_LIST.filter((s) => s.id !== excludeStoreId).map((store) => ({
    store,
    url: store.searchUrl(clean),
  }));
}
