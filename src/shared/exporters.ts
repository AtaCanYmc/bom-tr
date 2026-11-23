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
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function exportBomAsMarkdown(projectName: string, items: WorkspaceBomItem[]): string {
  const header = [
    `# ${projectName} — BOM`,
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
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
