import {
  BOM_ITEM_KEYS,
  BOM_STATUSES,
  MATCH_CONFIDENCES,
  STOCK_STATUSES,
  type BomItem,
  type BomStatus,
  type MatchConfidence,
  type StockStatus,
} from './bom.ts';

export interface ValidationIssue {
  index: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  items: BomItem[];
  errors: ValidationIssue[];
}

const ALLOWED_KEYS = new Set<string>(BOM_ITEM_KEYS);
const STATUS_SET = new Set<string>(BOM_STATUSES);
const CONFIDENCE_SET = new Set<string>(MATCH_CONFIDENCES);
const STOCK_SET = new Set<string>(STOCK_STATUSES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateBomItem(input: unknown, index = 0): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(input)) {
    return [{ index, field: '$', message: 'BOM kalemi nesne (object) olmalıdır.' }];
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      issues.push({
        index,
        field: key,
        message: `Şema dışı fazladan alan: "${key}" (additionalProperties: false).`,
      });
    }
  }

  for (const key of BOM_ITEM_KEYS) {
    if (!(key in input)) {
      issues.push({ index, field: key, message: `Zorunlu alan eksik: "${key}".` });
    }
  }

  if ('raw_name' in input && !isNonEmptyString(input.raw_name)) {
    issues.push({ index, field: 'raw_name', message: 'Boş olmayan metin olmalıdır.' });
  }

  if ('canonical_name' in input && !isNonEmptyString(input.canonical_name)) {
    issues.push({ index, field: 'canonical_name', message: 'Boş olmayan metin olmalıdır.' });
  }

  if ('quantity' in input) {
    const q = input.quantity;
    const validQty = q === null || (typeof q === 'number' && Number.isInteger(q) && q >= 1);
    if (!validQty) {
      issues.push({
        index,
        field: 'quantity',
        message: 'Pozitif tam sayı (>= 1) veya null olmalıdır.',
      });
    }
  }

  if ('status' in input && (typeof input.status !== 'string' || !STATUS_SET.has(input.status))) {
    issues.push({
      index,
      field: 'status',
      message: `Geçersiz değer. Beklenen: ${BOM_STATUSES.join(' | ')}.`,
    });
  }

  if ('source_files' in input) {
    const sf = input.source_files;
    if (!Array.isArray(sf) || sf.length < 1 || !sf.every(isNonEmptyString)) {
      issues.push({
        index,
        field: 'source_files',
        message: 'En az 1 boş olmayan metin içeren dizi olmalıdır.',
      });
    }
  }

  if ('constraints' in input && !isPlainObject(input.constraints)) {
    issues.push({
      index,
      field: 'constraints',
      message: 'Anahtar-değer nesnesi (Record<string, unknown>) olmalıdır.',
    });
  }

  if ('search_queries' in input) {
    const sq = input.search_queries;
    if (!Array.isArray(sq) || sq.length < 1 || !sq.every(isNonEmptyString)) {
      issues.push({
        index,
        field: 'search_queries',
        message: 'En az 1 boş olmayan arama terimi içeren dizi olmalıdır.',
      });
    }
  }

  if (
    'match_confidence' in input &&
    (typeof input.match_confidence !== 'string' || !CONFIDENCE_SET.has(input.match_confidence))
  ) {
    issues.push({
      index,
      field: 'match_confidence',
      message: `Geçersiz değer. Beklenen: ${MATCH_CONFIDENCES.join(' | ')}.`,
    });
  }

  if (
    'stock_status' in input &&
    (typeof input.stock_status !== 'string' || !STOCK_SET.has(input.stock_status))
  ) {
    issues.push({
      index,
      field: 'stock_status',
      message: `Geçersiz değer. Beklenen: ${STOCK_STATUSES.join(' | ')}.`,
    });
  }

  if ('notes' in input && typeof input.notes !== 'string') {
    issues.push({ index, field: 'notes', message: 'Metin (string) olmalıdır.' });
  }

  return issues;
}

export function validateBomPayload(payload: unknown): ValidationResult {
  if (!Array.isArray(payload)) {
    return {
      ok: false,
      items: [],
      errors: [{ index: -1, field: '$', message: 'BOM JSON kökü bir dizi (array) olmalıdır.' }],
    };
  }

  const errors: ValidationIssue[] = [];
  const items: BomItem[] = [];

  payload.forEach((entry, index) => {
    const itemErrors = validateBomItem(entry, index);
    if (itemErrors.length > 0) {
      errors.push(...itemErrors);
    } else {
      const obj = entry as Record<string, unknown>;
      items.push({
        raw_name: (obj.raw_name as string).trim(),
        canonical_name: (obj.canonical_name as string).trim(),
        quantity: obj.quantity as number | null,
        status: obj.status as BomStatus,
        source_files: (obj.source_files as string[]).map((s) => s.trim()),
        constraints: obj.constraints as Record<string, unknown>,
        search_queries: (obj.search_queries as string[]).map((s) => s.trim()),
        match_confidence: obj.match_confidence as MatchConfidence,
        stock_status: obj.stock_status as StockStatus,
        notes: obj.notes as string,
      });
    }
  });

  return { ok: errors.length === 0, items: errors.length === 0 ? items : [], errors };
}

export function parseAndValidateBomJson(rawText: string): ValidationResult {
  try {
    const parsed: unknown = JSON.parse(rawText);
    return validateBomPayload(parsed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Geçersiz JSON';
    return {
      ok: false,
      items: [],
      errors: [{ index: -1, field: '$', message: `JSON ayrıştırma hatası: ${detail}` }],
    };
  }
}
