import { create } from 'zustand';
import { PENDING_CONTEXT_ITEM_KEY, STORAGE_STATE_KEY } from '../background/storageKeys';
import {
  DEFAULT_SETTINGS,
  createEmptyBomItem,
  createSampleBomItems,
  type ApiHealthStatus,
  type BomItem,
  type BomProject,
  type CandidateEvidence,
  type CartOptimizationResult,
  type ExtensionSettings,
  type PageCaptureResult,
  type WorkspaceBomItem,
} from '../shared/bom';
import { sendBackgroundMessage, storageGet, storageRemove, storageSet } from './chromeBridge';

interface PersistedWorkspace {
  projects: BomProject[];
  activeProjectId: string;
  settings: ExtensionSettings;
}

interface PendingContextPayload {
  id: string;
  kind: 'selection' | 'page';
  text?: string;
  capture?: PageCaptureResult;
  createdAt: string;
}

export interface WorkspaceState {
  hydrated: boolean;
  projects: BomProject[];
  activeProjectId: string;
  settings: ExtensionSettings;
  apiHealth: ApiHealthStatus | null;
  lastCapture: PageCaptureResult | null;
  lastOptimization: CartOptimizationResult | null;
  notice: string | null;

  hydrate: () => Promise<void>;
  consumePendingContextItem: () => Promise<void>;
  setNotice: (message: string | null) => void;
  setApiHealth: (health: ApiHealthStatus) => void;
  setLastCapture: (capture: PageCaptureResult | null) => void;
  setLastOptimization: (result: CartOptimizationResult | null) => void;
  updateSettings: (patch: Partial<ExtensionSettings>) => void;

  selectProject: (projectId: string) => void;
  createProject: (name: string, initialItems?: BomItem[]) => string;
  renameProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;

  addItem: (bom?: BomItem, candidates?: CandidateEvidence[]) => void;
  addItemFromCapture: (capture: PageCaptureResult) => void;
  importItems: (items: BomItem[], mode: 'replace' | 'append' | 'new_project', projectName?: string) => void;
  updateItemBom: (itemId: string, patch: Partial<BomItem>) => void;
  removeItem: (itemId: string) => void;
  attachCandidates: (itemId: string, candidates: CandidateEvidence[]) => void;
  selectCandidate: (itemId: string, candidateId: string, approveLock: boolean) => void;
}

function wrapBomItem(bom: BomItem, candidates: CandidateEvidence[] = []): WorkspaceBomItem {
  return {
    id: crypto.randomUUID(),
    bom,
    candidates,
    selectedCandidateId: null,
    selectionLocked: false,
  };
}

function createInitialProject(): BomProject {
  const now = new Date().toISOString();
  return {
    id: 'default-project',
    name: 'Örnek ESP32 BOM',
    createdAt: now,
    updatedAt: now,
    items: createSampleBomItems().map((bom) => wrapBomItem(bom)),
  };
}

function persistAndSyncBadge(state: Pick<WorkspaceState, 'projects' | 'activeProjectId' | 'settings'>): void {
  const payload: PersistedWorkspace = {
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    settings: state.settings,
  };
  void storageSet(STORAGE_STATE_KEY, payload);

  const active = state.projects.find((p) => p.id === state.activeProjectId);
  if (active) {
    const attentionCount = active.items.filter(
      (i) => i.bom.status === 'inferred_required' || i.bom.match_confidence === 'ambiguous',
    ).length;
    void sendBackgroundMessage({
      type: 'UPDATE_BADGE',
      count: active.items.length,
      attentionCount,
    });
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  hydrated: false,
  projects: [createInitialProject()],
  activeProjectId: 'default-project',
  settings: DEFAULT_SETTINGS,
  apiHealth: null,
  lastCapture: null,
  lastOptimization: null,
  notice: null,

  hydrate: async () => {
    const saved = await storageGet<PersistedWorkspace>(STORAGE_STATE_KEY);
    if (saved && Array.isArray(saved.projects) && saved.projects.length > 0) {
      const validActive = saved.projects.some((p) => p.id === saved.activeProjectId)
        ? saved.activeProjectId
        : saved.projects[0]!.id;
      set({
        hydrated: true,
        projects: saved.projects,
        activeProjectId: validActive,
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
      });
    } else {
      set({ hydrated: true });
    }
    await get().consumePendingContextItem();
    const { projects, activeProjectId, settings } = get();
    persistAndSyncBadge({ projects, activeProjectId, settings });
  },

  consumePendingContextItem: async () => {
    const pending = await storageGet<PendingContextPayload>(PENDING_CONTEXT_ITEM_KEY);
    if (!pending) return;
    await storageRemove(PENDING_CONTEXT_ITEM_KEY);

    if (pending.kind === 'selection' && pending.text) {
      get().addItem({
        ...createEmptyBomItem(pending.text),
        source_files: ['context-menu:selection'],
        notes: 'Sağ tık menüsünden eklendi; teknik özellikleri doğrulayın.',
      });
      set({ notice: `"${pending.text}" sağ tık menüsünden BOM'a eklendi.` });
    } else if (pending.kind === 'page' && pending.capture) {
      get().addItemFromCapture(pending.capture);
      set({
        lastCapture: pending.capture,
        notice: 'Aktif mağaza sayfasından ürün BOM\'a eklendi.',
      });
    }
  },

  setNotice: (notice) => set({ notice }),
  setApiHealth: (apiHealth) => set({ apiHealth }),
  setLastCapture: (lastCapture) => set({ lastCapture }),
  setLastOptimization: (lastOptimization) => set({ lastOptimization }),

  updateSettings: (patch) => {
    set((state) => {
      const settings = { ...state.settings, ...patch };
      persistAndSyncBadge({ projects: state.projects, activeProjectId: state.activeProjectId, settings });
      return { settings };
    });
  },

  selectProject: (activeProjectId) => {
    set((state) => {
      persistAndSyncBadge({ projects: state.projects, activeProjectId, settings: state.settings });
      return { activeProjectId, lastOptimization: null };
    });
  },

  createProject: (name, initialItems = []) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const project: BomProject = {
      id,
      name: name.trim() || 'Yeni BOM',
      createdAt: now,
      updatedAt: now,
      items: initialItems.map((bom) => wrapBomItem(bom)),
    };
    set((state) => {
      const projects = [...state.projects, project];
      persistAndSyncBadge({ projects, activeProjectId: id, settings: state.settings });
      return { projects, activeProjectId: id, lastOptimization: null };
    });
    return id;
  },

  renameProject: (projectId, name) => {
    const clean = name.trim();
    if (!clean) return;
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === projectId ? { ...p, name: clean, updatedAt: new Date().toISOString() } : p,
      );
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects };
    });
  },

  deleteProject: (projectId) => {
    set((state) => {
      if (state.projects.length <= 1) return state;
      const projects = state.projects.filter((p) => p.id !== projectId);
      const activeProjectId =
        state.activeProjectId === projectId ? projects[0]!.id : state.activeProjectId;
      persistAndSyncBadge({ projects, activeProjectId, settings: state.settings });
      return { projects, activeProjectId, lastOptimization: null };
    });
  },

  addItem: (bom, candidates = []) => {
    const entry = wrapBomItem(bom ?? createEmptyBomItem(), candidates);
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === state.activeProjectId
          ? { ...p, updatedAt: new Date().toISOString(), items: [entry, ...p.items] }
          : p,
      );
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects };
    });
  },

  addItemFromCapture: (capture) => {
    const name = capture.title?.trim() || `${capture.storeName ?? 'Mağaza'} Ürünü`;
    const candidate: CandidateEvidence | null =
      capture.supported && capture.url
        ? {
            id: `${capture.storeId ?? 'dom'}:${capture.url}`,
            store: capture.storeId ?? capture.storeName ?? 'unknown',
            title: name,
            unitPrice: capture.price,
            currency: capture.currency,
            formattedPrice: capture.formattedPrice ?? undefined,
            url: capture.url,
            stockStatus: capture.stockStatus,
            sku: capture.sku ?? undefined,
            observedAt: capture.observedAt,
            source: 'dom-capture',
            verifiedByUser: false,
          }
        : null;

    const bom: BomItem = {
      raw_name: name,
      canonical_name: name,
      quantity: 1,
      status: 'confirmed',
      source_files: [capture.url || 'dom-capture'],
      constraints: capture.sku ? { sku: capture.sku } : {},
      search_queries: [name],
      match_confidence: capture.partial ? 'partial' : 'partial',
      stock_status: capture.stockStatus,
      notes: capture.partial
        ? `Sayfadan kısmi okuma (${capture.missingFields.join(', ')}); teknik uyumluluk ve fiyat doğrulanmalı.`
        : `Sayfadan yakalandı (${capture.storeName ?? 'mağaza'}). Teknik uyumluluk onayı bekleniyor.`,
    };

    get().addItem(bom, candidate ? [candidate] : []);
  },

  importItems: (items, mode, projectName) => {
    if (mode === 'new_project') {
      get().createProject(projectName || `İçe Aktarılan BOM (${items.length})`, items);
      return;
    }
    const wrapped = items.map((bom) => wrapBomItem(bom));
    set((state) => {
      const projects = state.projects.map((p) => {
        if (p.id !== state.activeProjectId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          items: mode === 'replace' ? wrapped : [...p.items, ...wrapped],
        };
      });
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects, lastOptimization: null };
    });
  },

  updateItemBom: (itemId, patch) => {
    set((state) => {
      const projects = state.projects.map((p) => {
        if (p.id !== state.activeProjectId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          items: p.items.map((item) => {
            if (item.id !== itemId) return item;
            const nextBom = { ...item.bom, ...patch };
            // Unlock selection automatically if confidence drops to partial/ambiguous/unmatched.
            const nextLocked =
              nextBom.match_confidence === 'exact' ? item.selectionLocked : false;
            return { ...item, bom: nextBom, selectionLocked: nextLocked };
          }),
        };
      });
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects };
    });
  },

  removeItem: (itemId) => {
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === state.activeProjectId
          ? {
              ...p,
              updatedAt: new Date().toISOString(),
              items: p.items.filter((i) => i.id !== itemId),
            }
          : p,
      );
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects };
    });
  },

  attachCandidates: (itemId, incoming) => {
    set((state) => {
      const projects = state.projects.map((p) => {
        if (p.id !== state.activeProjectId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          items: p.items.map((item) => {
            if (item.id !== itemId) return item;
            const byId = new Map(item.candidates.map((c) => [c.id, c]));
            for (const c of incoming) byId.set(c.id, c);
            return { ...item, candidates: Array.from(byId.values()) };
          }),
        };
      });
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects };
    });
  },

  selectCandidate: (itemId, candidateId, approveLock) => {
    set((state) => {
      const projects = state.projects.map((p) => {
        if (p.id !== state.activeProjectId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          items: p.items.map((item) => {
            if (item.id !== itemId) return item;
            const chosen = item.candidates.find((c) => c.id === candidateId);
            if (!chosen) return item;
            // Never lock partial or ambiguous matches without explicit user approval.
            const isAmbiguousOrPartial =
              item.bom.match_confidence === 'partial' ||
              item.bom.match_confidence === 'ambiguous';
            const canLock = approveLock || !isAmbiguousOrPartial;

            return {
              ...item,
              selectedCandidateId: candidateId,
              selectionLocked: canLock,
              candidates: item.candidates.map((c) =>
                c.id === candidateId ? { ...c, verifiedByUser: approveLock } : c,
              ),
              bom: {
                ...item.bom,
                stock_status: chosen.stockStatus,
                match_confidence: approveLock
                  ? 'exact'
                  : item.bom.match_confidence === 'unmatched'
                    ? 'partial'
                    : item.bom.match_confidence,
              },
            };
          }),
        };
      });
      persistAndSyncBadge({ projects, activeProjectId: state.activeProjectId, settings: state.settings });
      return { projects };
    });
  },
}));
