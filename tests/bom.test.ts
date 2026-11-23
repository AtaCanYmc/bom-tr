import assert from 'node:assert/strict';
import test from 'node:test';
import { computeCartScenarios } from '../src/background/roboApi.ts';
import { inferStockFromText, parseTurkishPrice } from '../src/content/parser.ts';
import { createSampleBomItems, type CandidateEvidence, type WorkspaceBomItem } from '../src/shared/bom.ts';
import { exportBomAsCsv, exportBomAsJson, exportBomAsMarkdown } from '../src/shared/exporters.ts';
import { parseAndValidateBomJson } from '../src/shared/validator.ts';

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
