import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { computeCartScenarios } from '../src/background/roboApi.ts';
import { extractStoreProduct } from '../src/content/adapters.ts';
import { inferStockFromText, parseTurkishPrice } from '../src/content/parser.ts';
import {
  SUPPORTED_LOCALES,
  createSampleBomItems,
  type CandidateEvidence,
  type WorkspaceBomItem,
} from '../src/shared/bom.ts';
import {
  exportBomAsCsv,
  exportBomAsEasyedaCsv,
  exportBomAsJson,
  exportBomAsKicadCsv,
  exportBomAsMarkdown,
  parseBomCsv,
} from '../src/shared/exporters.ts';
import { t, type I18nKey } from '../src/shared/i18n.ts';
import { STORES, type StoreId } from '../src/shared/stores.ts';
import { parseAndValidateBomJson } from '../src/shared/validator.ts';
import { createDocumentFromHtml } from './domFixture.ts';

test('validates 10-field bom-sourcing schema and rejects extra or invalid fields', () => {
  const sample = createSampleBomItems();
  const valid = parseAndValidateBomJson(JSON.stringify(sample));
  assert.equal(valid.ok, true);
  assert.equal(valid.items.length, sample.length);

  const withExtra = [{ ...sample[0], extra_field: true }];
  const extraRes = parseAndValidateBomJson(JSON.stringify(withExtra));
  assert.equal(extraRes.ok, false);
  assert.ok(extraRes.errors.some((e) => e.field === 'extra_field'));

  const badQty = [{ ...sample[0], quantity: 0 }];
  const qtyRes = parseAndValidateBomJson(JSON.stringify(badQty));
  assert.equal(qtyRes.ok, false);
  assert.ok(qtyRes.errors.some((e) => e.field === 'quantity'));
});

test('exporters emit pure 10-field JSON without workspace candidate pollution', () => {
  const sample = createSampleBomItems();
  const wrapped: WorkspaceBomItem[] = [
    {
      id: 'w1',
      bom: sample[0]!,
      candidates: [
        {
          id: 'c1',
          store: 'robotistan',
          title: 'ESP32 Dev',
          unitPrice: 150,
          currency: 'TRY',
          url: 'https://www.robotistan.com/esp32',
          stockStatus: 'in_stock',
          observedAt: '2026-11-23T07:00:00.000Z',
          source: 'robo-api',
          verifiedByUser: true,
        },
      ],
      selectedCandidateId: 'c1',
      selectionLocked: true,
    },
  ];

  const json = exportBomAsJson(wrapped);
  const revalidated = parseAndValidateBomJson(json);
  assert.equal(revalidated.ok, true);
  assert.equal(Object.keys(JSON.parse(json)[0]).length, 10);

  const md = exportBomAsMarkdown('Test Proje', wrapped);
  assert.match(md, /ESP32-WROOM-32/);
  assert.match(md, /robotistan/);

  const csv = exportBomAsCsv(wrapped);
  assert.ok(csv.startsWith('raw_name,canonical_name,quantity,status,source_files'));
});

test('parses Turkish price formats and stock signals safely', () => {
  assert.equal(parseTurkishPrice('145,50 TL'), 145.5);
  assert.equal(parseTurkishPrice('1.250,00 ₺'), 1250);
  assert.equal(parseTurkishPrice('299.90'), 299.9);
  assert.equal(parseTurkishPrice('stok yok'), null);

  assert.equal(inferStockFromText('https://schema.org/InStock'), 'in_stock');
  assert.equal(inferStockFromText('Tükendi'), 'out_of_stock');
  assert.equal(inferStockFromText(''), 'unknown');
});

test('computes single-store vs split-store totals with shipping rules', () => {
  const now = '2026-11-23T07:00:00.000Z';
  const candidates: Record<string, CandidateEvidence[]> = {
    ESP32: [
      {
        id: 'r1',
        store: 'robotistan',
        title: 'ESP32',
        unitPrice: 200,
        currency: 'TRY',
        url: 'https://www.robotistan.com/esp32',
        stockStatus: 'in_stock',
        observedAt: now,
        source: 'robo-api',
        verifiedByUser: false,
      },
      {
        id: 'd1',
        store: 'direncnet',
        title: 'ESP32',
        unitPrice: 180,
        currency: 'TRY',
        url: 'https://www.direnc.net/esp32',
        stockStatus: 'in_stock',
        observedAt: now,
        source: 'robo-api',
        verifiedByUser: false,
      },
    ],
    BME280: [
      {
        id: 'r2',
        store: 'robotistan',
        title: 'BME280',
        unitPrice: 100,
        currency: 'TRY',
        url: 'https://www.robotistan.com/bme280',
        stockStatus: 'in_stock',
        observedAt: now,
        source: 'robo-api',
        verifiedByUser: false,
      },
      {
        id: 'd2',
        store: 'direncnet',
        title: 'BME280',
        unitPrice: 130,
        currency: 'TRY',
        url: 'https://www.direnc.net/bme280',
        stockStatus: 'in_stock',
        observedAt: now,
        source: 'robo-api',
        verifiedByUser: false,
      },
    ],
  };

  const { singleStore, splitStore } = computeCartScenarios(
    [
      { query: 'ESP32', quantity: 1 },
      { query: 'BME280', quantity: 1 },
    ],
    candidates,
  );

  assert.ok(singleStore);
  assert.ok(splitStore);
  assert.equal(singleStore.coverageCount, 2);
  assert.equal(splitStore.coverageCount, 2);
  // Single store (robotistan: 300 + 34.90 = 334.90) beats split (180 + 29.90 + 100 + 34.90 = 344.80).
  assert.ok(singleStore.grandTotal < splitStore.grandTotal);
});

test('extracts product data from saved HTML fixtures across all 6 Turkish stores', () => {
  const cases: Array<{
    storeId: StoreId;
    titleContains: string;
    price: number;
    stockStatus: string;
    sku: string;
  }> = [
    { storeId: 'robotistan', titleContains: 'ESP32-WROOM-32', price: 249.9, stockStatus: 'in_stock', sku: 'RBT-ESP32-30P' },
    { storeId: 'robolink', titleContains: 'BME280', price: 145.5, stockStatus: 'in_stock', sku: 'RLM-BME280' },
    { storeId: 'robo90', titleContains: 'SG90', price: 89.75, stockStatus: 'low_stock', sku: 'R90-SG90' },
    { storeId: 'direncnet', titleContains: 'AMS1117', price: 12.4, stockStatus: 'in_stock', sku: 'DRN-AMS1117-33' },
    { storeId: 'motorobit', titleContains: 'L298N', price: 118, stockStatus: 'out_of_stock', sku: 'MTB-L298N' },
    { storeId: 'robotsepeti', titleContains: 'Jumper Kablo', price: 64.5, stockStatus: 'out_of_stock', sku: 'RS-JMP-20' },
  ];

  for (const c of cases) {
    const html = readFileSync(join(process.cwd(), 'tests', 'fixtures', `${c.storeId}.html`), 'utf-8');
    const doc = createDocumentFromHtml(html);
    const result = extractStoreProduct(doc, `${STORES[c.storeId].baseUrl}/test-product`, c.storeId);
    assert.equal(result.supported, true, c.storeId);
    assert.equal(result.storeId, c.storeId);
    assert.ok(result.title?.includes(c.titleContains), `${c.storeId} title`);
    assert.equal(result.price, c.price, `${c.storeId} price`);
    assert.equal(result.stockStatus, c.stockStatus, `${c.storeId} stock`);
    assert.equal(result.sku, c.sku, `${c.storeId} sku`);
    assert.equal(result.partial, false, `${c.storeId} partial`);
  }

  // Graceful degradation when page has no matching product selectors.
  const emptyDoc = createDocumentFromHtml('<html lang="tr"><body><p>Kategori</p></body></html>');
  const degraded = extractStoreProduct(emptyDoc, 'https://www.robotistan.com/kategori', 'robotistan');
  assert.equal(degraded.partial, true);
  assert.deepEqual(degraded.missingFields, ['title', 'price', 'stockStatus']);
});

test('imports and exports KiCad and EasyEDA CSV BOM tables into the 10-field contract', () => {
  const kicadCsv = [
    'Reference,Value,Footprint,Qty,Datasheet,Description',
    '"R1, R2",10k,Resistor_SMD:R_0603_1608Metric,2,~,"Pull-up resistor"',
    'U1,ESP32-WROOM-32,RF_Module:ESP32-WROOM-32,1,https://espressif.com/esp32.pdf,"WiFi MCU"',
  ].join('\n');

  const kicadParsed = parseBomCsv(kicadCsv);
  assert.equal(kicadParsed.ok, true);
  assert.equal(kicadParsed.format, 'kicad');
  assert.equal(kicadParsed.items.length, 2);
  assert.equal(kicadParsed.items[0]!.quantity, 2);
  assert.equal(kicadParsed.items[0]!.constraints.footprint, 'Resistor_SMD:R_0603_1608Metric');
  assert.equal(parseAndValidateBomJson(JSON.stringify(kicadParsed.items)).ok, true);

  const easyedaCsv = [
    'ID,Name,Designator,Footprint,Quantity,Manufacturer Part,Manufacturer,Supplier,Supplier Part',
    '1,AMS1117-3.3,U2,SOT-223,3,AMS1117-3.3,AMS,LCSC,C6186',
  ].join('\n');

  const easyParsed = parseBomCsv(easyedaCsv);
  assert.equal(easyParsed.ok, true);
  assert.equal(easyParsed.format, 'easyeda');
  assert.equal(easyParsed.items.length, 1);
  assert.equal(easyParsed.items[0]!.canonical_name, 'AMS1117-3.3');
  assert.equal(easyParsed.items[0]!.constraints.supplier_part, 'C6186');
  assert.equal(parseAndValidateBomJson(JSON.stringify(easyParsed.items)).ok, true);

  const wrapped: WorkspaceBomItem[] = easyParsed.items.map((bom, i) => ({
    id: `w-${i}`,
    bom,
    candidates: [],
    selectedCandidateId: null,
    selectionLocked: false,
  }));
  assert.ok(exportBomAsKicadCsv(wrapped).startsWith('Reference,Value,Footprint,Qty,Datasheet,Description'));
  assert.ok(exportBomAsEasyedaCsv(wrapped).startsWith('ID,Name,Designator,Footprint,Quantity,Manufacturer Part,Supplier Part'));
});

test('applies per-project currency and shipping threshold overrides in cart scenarios', () => {
  const now = '2026-11-23T07:00:00.000Z';
  const candidates: Record<string, CandidateEvidence[]> = {
    ESP32: [
      {
        id: 'r1',
        store: 'robotistan',
        title: 'ESP32',
        unitPrice: 250,
        currency: 'USD',
        url: 'https://www.robotistan.com/esp32',
        stockStatus: 'in_stock',
        observedAt: now,
        source: 'robo-api',
        verifiedByUser: false,
      },
    ],
  };

  const { singleStore } = computeCartScenarios([{ query: 'ESP32', quantity: 2 }], candidates, {
    currency: 'USD',
    freeShippingThreshold: 400,
  });

  assert.ok(singleStore);
  assert.equal(singleStore.currency, 'USD');
  assert.equal(singleStore.shippingTotal, 0);
  assert.equal(singleStore.grandTotal, 500);
});

test('resolves non-empty i18n strings across tr, en, fr, de, es locales', () => {
  const sampleKeys: I18nKey[] = ['tabBom', 'tabCart', 'optimizeCart', 'importTitle', 'languageLabel'];
  assert.deepEqual([...SUPPORTED_LOCALES], ['tr', 'en', 'fr', 'de', 'es']);
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of sampleKeys) {
      const value = t(locale, key);
      assert.ok(value.length > 0, `Missing ${locale}.${key}`);
    }
  }
});
