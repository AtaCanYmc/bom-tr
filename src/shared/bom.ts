import type { StoreId } from './stores';

export const BOM_STATUSES = [
  'confirmed',
  'inferred_required',
  'optional_or_assumed',
] as const;
export type BomStatus = (typeof BOM_STATUSES)[number];

export const MATCH_CONFIDENCES = [
  'exact',
  'partial',
  'ambiguous',
  'unmatched',
] as const;
export type MatchConfidence = (typeof MATCH_CONFIDENCES)[number];

export const STOCK_STATUSES = [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'unknown',
] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

// Exact 10-field contract defined by bom-sourcing/schemas/bom-output.schema.json.
export interface BomItem {
  raw_name: string;
  canonical_name: string;
  quantity: number | null;
  status: BomStatus;
  source_files: string[];
  constraints: Record<string, unknown>;
  search_queries: string[];
  match_confidence: MatchConfidence;
  stock_status: StockStatus;
  notes: string;
}

export const BOM_ITEM_KEYS = [
  'raw_name',
  'canonical_name',
  'quantity',
  'status',
  'source_files',
  'constraints',
  'search_queries',
  'match_confidence',
  'stock_status',
  'notes',
] as const;

export interface CandidateEvidence {
  id: string;
  store: StoreId | string;
  title: string;
  unitPrice: number | null;
  currency: string;
  formattedPrice?: string;
  url: string;
  stockStatus: StockStatus;
  sku?: string;
  observedAt: string;
  source: 'robo-api' | 'dom-capture' | 'manual';
  verifiedByUser: boolean;
}

// Workspace wrapper keeps candidate/selection metadata outside the strict 10-field BomItem.
export interface WorkspaceBomItem {
  id: string;
  bom: BomItem;
  candidates: CandidateEvidence[];
  selectedCandidateId: string | null;
  // Partial/ambiguous matches stay unlocked until explicit user approval.
  selectionLocked: boolean;
}

export interface BomProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: WorkspaceBomItem[];
}

export type ThemeMode = 'dark' | 'light';

export interface ExtensionSettings {
  apiBaseUrl: string;
  deliveryDestination: string;
  currency: string;
  batchTabDelayMs: number;
  theme: ThemeMode;
}

export interface ApiHealthStatus {
  online: boolean;
  version?: string;
  checkedAt: string;
  error?: string;
}

export interface PageCaptureResult {
  supported: boolean;
  storeId: StoreId | null;
  storeName: string | null;
  url: string;
  title: string | null;
  price: number | null;
  currency: string;
  formattedPrice: string | null;
  stockStatus: StockStatus;
  sku: string | null;
  observedAt: string;
  partial: boolean;
  missingFields: string[];
  warning?: string;
}

export interface StoreCartBreakdown {
  store: string;
  subtotal: number;
  shippingFee: number;
  freeShippingThreshold: number | null;
  total: number;
  items: Array<{
    query: string;
    title: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    url: string;
    stockStatus: StockStatus;
  }>;
}

export interface CartScenario {
  kind: 'single_store' | 'split_store';
  label: string;
  stores: StoreCartBreakdown[];
  itemsSubtotal: number;
  shippingTotal: number;
  grandTotal: number;
  currency: string;
  coverageCount: number;
  requestedCount: number;
  missingItems: string[];
  assumptions: string[];
}

export interface CartOptimizationResult {
  source: 'robo-api' | 'local-candidates';
  observedAt: string;
  singleStore: CartScenario | null;
  splitStore: CartScenario | null;
  winningLabel: string | null;
  rawSummary?: string;
  warnings: string[];
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: 'http://127.0.0.1:8000',
  deliveryDestination: 'TR',
  currency: 'TRY',
  batchTabDelayMs: 350,
  theme: 'dark',
};

export function createEmptyBomItem(name = 'Yeni Bileşen'): BomItem {
  const clean = name.trim() || 'Yeni Bileşen';
  return {
    raw_name: clean,
    canonical_name: clean,
    quantity: 1,
    status: 'confirmed',
    source_files: ['manual:sidepanel'],
    constraints: {},
    search_queries: [clean],
    match_confidence: 'unmatched',
    stock_status: 'unknown',
    notes: '',
  };
}

export function createSampleBomItems(): BomItem[] {
  return [
    {
      raw_name: 'ESP32 dev board',
      canonical_name: 'ESP32-WROOM-32 Development Board',
      quantity: 1,
      status: 'confirmed',
      source_files: ['README.md:14', 'firmware/platformio.ini:6'],
      constraints: {
        supply_voltage: '5V USB / 3.3V logic',
        interfaces: ['I2C', 'UART'],
      },
      search_queries: ['ESP32-WROOM-32', 'ESP32 geliştirme kartı'],
      match_confidence: 'unmatched',
      stock_status: 'unknown',
      notes: 'USB konnektör tipi (Micro-USB / Type-C): belirsiz / projeden doğrulanmalı.',
    },
    {
      raw_name: 'BME280 3.3V I2C sensor',
      canonical_name: 'BME280 I2C 3.3V Basınç ve Sıcaklık Sensörü',
      quantity: 1,
      status: 'confirmed',
      source_files: ['src/sensors.cpp:22'],
      constraints: {
        voltage: '3.3V',
        protocol: 'I2C',
      },
      search_queries: ['BME280 I2C 3.3V', 'BME280 sensör modülü'],
      match_confidence: 'ambiguous',
      stock_status: 'unknown',
      notes: 'BMP280 (nem sensörü yok) ile karıştırılmamalı; BME280 doğrulanmalı.',
    },
    {
      raw_name: 'Inferred: 5V 2A USB power supply & jumper cables',
      canonical_name: 'Dişi-Erkek Jumper Kablo Seti 20cm',
      quantity: null,
      status: 'inferred_required',
      source_files: ['README.md:14'],
      constraints: {
        pitch: '2.54mm',
      },
      search_queries: ['jumper kablo 20cm', 'dupont kablo seti'],
      match_confidence: 'unmatched',
      stock_status: 'unknown',
      notes: 'Bağlantı kablolaması projeden çıkarıldı; adet doğrulaması gerekli.',
    },
  ];
}
