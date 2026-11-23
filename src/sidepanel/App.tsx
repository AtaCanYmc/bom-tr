import {
  ArrowLeftRight,
  Cpu,
  ListChecks,
  Plus,
  ScanSearch,
  Settings,
  ShoppingCart,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PENDING_CONTEXT_ITEM_KEY } from '../background/storageKeys';
import { isExtensionRuntime, sendBackgroundMessage } from './chromeBridge';
import { BomTab } from './components/BomTab';
import { BridgeTab } from './components/BridgeTab';
import { CaptureCompareTab } from './components/CaptureCompareTab';
import { CartTab } from './components/CartTab';
import { SettingsTab } from './components/SettingsTab';
import { useWorkspaceStore } from './store';

type NavTab = 'bom' | 'capture' | 'cart' | 'bridge' | 'settings';

export function App() {
  const {
    hydrated,
    projects,
    activeProjectId,
    settings,
    apiHealth,
    notice,
    hydrate,
    consumePendingContextItem,
    selectProject,
    createProject,
    deleteProject,
    setApiHealth,
    setNotice,
  } = useWorkspaceStore();

  const [tab, setTab] = useState<NavTab>('bom');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      const res = await sendBackgroundMessage({
        type: 'CHECK_API_HEALTH',
        apiBaseUrl: settings.apiBaseUrl,
      });
      if (res.ok && 'health' in res) {
        setApiHealth(res.health);
      }
    })();
  }, [hydrated, settings.apiBaseUrl, setApiHealth]);

  useEffect(() => {
    if (!isExtensionRuntime() || !chrome.storage?.onChanged) return;
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes[PENDING_CONTEXT_ITEM_KEY]?.newValue) {
        void consumePendingContextItem();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [consumePendingContextItem]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold tracking-tight">bomTR</span>
          </div>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
              apiHealth?.online
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}
          >
            {apiHealth?.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {apiHealth?.online ? 'robo-api' : 'Offline'}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
          {projects.map((p) => {
            const active = p.id === activeProjectId;
            return (
              <div
                key={p.id}
                className={`inline-flex shrink-0 items-center rounded border text-[11px] ${
                  active
                    ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectProject(p.id)}
                  className="px-2 py-0.5"
                >
                  {p.name} ({p.items.length})
                </button>
                {projects.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteProject(p.id)}
                    title="Projeyi sil"
                    className="pr-1.5 text-slate-500 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => createProject(`BOM #${projects.length + 1}`)}
            title="Yeni BOM projesi"
            className="inline-flex shrink-0 items-center rounded border border-dashed border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <nav className="mt-2 grid grid-cols-5 gap-1">
          {[
            { id: 'bom' as const, label: 'BOM', icon: ListChecks },
            { id: 'capture' as const, label: 'Yakala', icon: ScanSearch },
            { id: 'cart' as const, label: 'Sepet', icon: ShoppingCart },
            { id: 'bridge' as const, label: 'Köprü', icon: ArrowLeftRight },
            { id: 'settings' as const, label: 'Ayar', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 rounded py-1 text-[10px] font-medium transition ${
                tab === id
                  ? 'bg-slate-800 text-sky-300'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {notice && (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-200">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 p-3">
        {tab === 'bom' && <BomTab />}
        {tab === 'capture' && <CaptureCompareTab />}
        {tab === 'cart' && <CartTab />}
        {tab === 'bridge' && <BridgeTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}
