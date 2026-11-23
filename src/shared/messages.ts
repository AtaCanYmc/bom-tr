import type {
  ApiHealthStatus,
  CandidateEvidence,
  CartOptimizationResult,
  PageCaptureResult,
} from './bom';

export type BackgroundRequest =
  | { type: 'CHECK_API_HEALTH'; apiBaseUrl: string }
  | { type: 'SEARCH_COMPONENT'; apiBaseUrl: string; query: string; limit?: number }
  | {
      type: 'OPTIMIZE_CART';
      apiBaseUrl: string;
      items: Array<{ query: string; quantity: number }>;
      localCandidatesByQuery?: Record<string, CandidateEvidence[]>;
      overrides?: { currency?: string; freeShippingThreshold?: number | null };
    }
  | { type: 'CAPTURE_ACTIVE_TAB' }
  | { type: 'OPEN_TABS_STAGGERED'; urls: string[]; delayMs?: number }
  | { type: 'UPDATE_BADGE'; count: number; attentionCount: number };

export type BackgroundResponse =
  | { ok: true; health: ApiHealthStatus }
  | { ok: true; candidates: CandidateEvidence[]; observedAt: string }
  | { ok: true; optimization: CartOptimizationResult }
  | { ok: true; capture: PageCaptureResult }
  | { ok: true; openedCount: number }
  | { ok: true }
  | { ok: false; error: string; offline?: boolean };

export type ContentRequest = { type: 'READ_PRODUCT_PAGE' };

export type ContentResponse = { ok: true; capture: PageCaptureResult } | { ok: false; error: string };
