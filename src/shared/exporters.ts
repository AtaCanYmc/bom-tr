import type { BomItem, WorkspaceBomItem } from './bom';

// Emits strictly the 10-field bom-sourcing schema without workspace metadata.
export function toPureBomItems(items: WorkspaceBomItem[]): BomItem[] {
  return items.map(({ bom }) => ({
    raw_name: bom.raw_name,
    canonical_name: bom.canonical_name,
    quantity: bom.quantity,
    status: bom.status,
    source_files: [...bom.source_files],
    constraints: { ...bom.constraints },
    search_queries: [...bom.search_queries],
    match_confidence: bom.match_confidence,
    stock_status: bom.stock_status,
    notes: bom.notes,
  }));
}

export function exportBomAsJson(items: WorkspaceBomItem[]): string {
  return JSON.stringify(toPureBomItems(items), null, 2);
}

function escapeMdCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function exportBomAsMarkdown(projectName: string, items: WorkspaceBomItem[]): string {
  const header = [
    `# ${projectName} | BOM`,
    '',
    '| # | Canonical Name | Raw Name | Qty | Status | Confidence | Stock | Selected Evidence | Notes |',
    '| :-: | :--- | :--- | :-: | :--- | :--- | :--- | :--- | :--- |',
  ];

  const rows = items.map((entry, idx) => {
    const { bom, candidates, selectedCandidateId } = entry;
    const chosen = candidates.find((c) => c.id === selectedCandidateId);
    const evidence = chosen
      ? `${chosen.store} (${chosen.unitPrice !== null ? `${chosen.unitPrice.toFixed(2)} ${chosen.currency}` : 'fiyat yok'})`
      : '-';

    return `| ${idx + 1} | ${escapeMdCell(bom.canonical_name)} | ${escapeMdCell(bom.raw_name)} | ${bom.quantity ?? 'null'} | \`${bom.status}\` | \`${bom.match_confidence}\` | \`${bom.stock_status}\` | ${escapeMdCell(evidence)} | ${escapeMdCell(bom.notes)} |`;
  });

  return [...header, ...rows, ''].join('\n');
}

function escapeCsvCell(value: string): string {
  // Neutralize spreadsheet formula injection when untrusted store text is exported to CSV.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportBomAsCsv(items: WorkspaceBomItem[]): string {
  const columns = [
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
  ];

  const lines = [columns.join(',')];
  for (const { bom } of items) {
    const row = [
      bom.raw_name,
      bom.canonical_name,
      bom.quantity === null ? '' : String(bom.quantity),
      bom.status,
      bom.source_files.join('; '),
      JSON.stringify(bom.constraints),
      bom.search_queries.join('; '),
      bom.match_confidence,
      bom.stock_status,
      bom.notes,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return lines.join('\n');
}

function strConstraint(constraints: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = constraints[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function exportBomAsKicadCsv(items: WorkspaceBomItem[]): string {
  const lines = ['Reference,Value,Footprint,Qty,Datasheet,Description'];
  items.forEach(({ bom }, idx) => {
    const ref = strConstraint(bom.constraints, 'references', 'designator') || `U${idx + 1}`;
    const footprint = strConstraint(bom.constraints, 'footprint', 'package');
    const datasheet = strConstraint(bom.constraints, 'datasheet');
    const row = [
      ref,
      bom.canonical_name,
      footprint,
      bom.quantity === null ? '' : String(bom.quantity),
      datasheet,
      bom.notes,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });
  return lines.join('\n');
}

export function exportBomAsEasyedaCsv(items: WorkspaceBomItem[]): string {
  const lines = ['ID,Name,Designator,Footprint,Quantity,Manufacturer Part,Supplier Part'];
  items.forEach(({ bom }, idx) => {
    const designator = strConstraint(bom.constraints, 'designator', 'references') || `U${idx + 1}`;
    const footprint = strConstraint(bom.constraints, 'footprint', 'package');
    const mpn = strConstraint(bom.constraints, 'mpn', 'manufacturer_part') || bom.canonical_name;
    const supplierPart = strConstraint(bom.constraints, 'supplier_part', 'lcsc', 'sku');
    const row = [
      String(idx + 1),
      bom.raw_name,
      designator,
      footprint,
      bom.quantity === null ? '' : String(bom.quantity),
      mpn,
      supplierPart,
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });
  return lines.join('\n');
}

export type CsvBomFormat = 'kicad' | 'easyeda';

export interface CsvBomParseResult {
  ok: boolean;
  format: CsvBomFormat | null;
  items: BomItem[];
  error?: string;
}

// RFC-4180 CSV/TSV/semicolon row parser; handles quoted cells and escaped quotes.
function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '').trim();
  if (!text) return [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes('\t')
    ? '\t'
    : firstLine.split(';').length > firstLine.split(',').length
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export function parseBomCsv(rawText: string): CsvBomParseResult {
  const rows = parseCsvRows(rawText);
  if (rows.length < 2) {
    return { ok: false, format: null, items: [], error: 'CSV en az başlık ve 1 satır içermeli.' };
  }

  const headers = rows[0]!.map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  const col = (...names: string[]): number => {
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const isEasyeda =
    col('manufacturer part', 'lcsc part', 'supplier part') !== -1 ||
    (col('comment', 'name') !== -1 && col('designator') !== -1 && col('footprint') !== -1);
  const isKicad =
    col('value', 'designation') !== -1 &&
    (col('reference', 'references', 'designator') !== -1 || col('footprint') !== -1);

  if (!isEasyeda && !isKicad) {
    return {
      ok: false,
      format: null,
      items: [],
      error: 'Desteklenen KiCad veya EasyEDA CSV başlığı algılanamadı.',
    };
  }

  const format: CsvBomFormat = isEasyeda ? 'easyeda' : 'kicad';
  const items: BomItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const get = (...names: string[]) => {
      const idx = col(...names);
      return idx >= 0 ? (r[idx] ?? '').trim() : '';
    };

    if (format === 'easyeda') {
      const name = get('name', 'comment');
      const mpn = get('manufacturer part');
      const designator = get('designator');
      const footprint = get('footprint');
      const manufacturer = get('manufacturer');
      const supplier = get('supplier');
      const supplierPart = get('supplier part', 'lcsc part');
      const qty =
        parsePositiveInt(get('quantity', 'qty')) ??
        (designator ? designator.split(/[,\s]+/).filter(Boolean).length || null : null);

      const rawName = name || mpn || designator;
      if (!rawName) continue;
      const canonical = mpn || name || designator;
      const constraints: Record<string, unknown> = {};
      if (footprint) constraints.footprint = footprint;
      if (designator) constraints.designator = designator;
      if (mpn) constraints.mpn = mpn;
      if (supplierPart) constraints.supplier_part = supplierPart;

      const queries = Array.from(new Set([mpn, name].filter(Boolean)));
      items.push({
        raw_name: rawName,
        canonical_name: canonical,
        quantity: qty,
        status: 'confirmed',
        source_files: ['import:easyeda-csv'],
        constraints,
        search_queries: queries.length > 0 ? queries : [canonical],
        match_confidence: 'unmatched',
        stock_status: 'unknown',
        notes: [manufacturer, supplier, supplierPart].filter(Boolean).join(' | '),
      });
    } else {
      const value = get('value', 'designation');
      const ref = get('reference', 'references', 'designator');
      const footprint = get('footprint', 'package');
      const datasheet = get('datasheet');
      const desc = get('description', 'supplier and ref');
      const qty =
        parsePositiveInt(get('qty', 'quantity')) ??
        (ref ? ref.split(/[,\s]+/).filter(Boolean).length || null : null);

      const rawName = value || ref;
      if (!rawName) continue;
      const canonical = footprint && !value.includes(footprint) ? `${rawName} ${footprint}` : rawName;
      const constraints: Record<string, unknown> = {};
      if (footprint) constraints.footprint = footprint;
      if (ref) constraints.references = ref;
      if (datasheet && datasheet !== '~') constraints.datasheet = datasheet;

      items.push({
        raw_name: rawName,
        canonical_name: canonical,
        quantity: qty,
        status: 'confirmed',
        source_files: ['import:kicad-csv'],
        constraints,
        search_queries: [rawName],
        match_confidence: 'unmatched',
        stock_status: 'unknown',
        notes: desc,
      });
    }
  }

  if (items.length === 0) {
    return { ok: false, format, items: [], error: 'CSV içinde geçerli bileşen satırı bulunamadı.' };
  }

  return { ok: true, format, items };
}
