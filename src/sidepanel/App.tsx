import {
  ArrowLeftRight,
  Check,
  Cpu,
  ListChecks,
  Moon,
  Pencil,
  Plus,
  ScanSearch,
  Settings,
  ShoppingCart,
  Sun,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PENDING_CONTEXT_ITEM_KEY } from '../background/storageKeys';
import { SUPPORTED_LOCALES, type Locale } from '../shared/bom';
import { LOCALE_LABELS, t, type I18nKey } from '../shared/i18n';
import { isExtensionRuntime, sendBackgroundMessage } from './chromeBridge';
import { BomTab } from './components/BomTab';
import { BridgeTab } from './components/BridgeTab';
import { CaptureCompareTab } from './components/CaptureCompareTab';
import { CartTab } from './components/CartTab';
import { SettingsTab } from './components/SettingsTab';
import { useWorkspaceStore } from './store';

type NavTab = 'bom' | 'capture' | 'cart' | 'bridge' | 'settings';

const NAV_TABS: Array<{ id: NavTab; labelKey: I18nKey; icon: typeof ListChecks }> = [
  { id: 'bom', labelKey: 'tabBom', icon: ListChecks },
  { id: 'capture', labelKey: 'tabCapture', icon: ScanSearch },
  { id: 'cart', labelKey: 'tabCart', icon: ShoppingCart },
  { id: 'bridge', labelKey: 'tabBridge', icon: ArrowLeftRight },
  { id: 'settings', labelKey: 'tabSettings', icon: Settings },
];

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
    renameProject,
    deleteProject,
    updateSettings,
    setApiHealth,
    setNotice,
  } = useWorkspaceStore();

  const [tab, setTab] = useState<NavTab>('bom');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.locale;
  }, [settings.theme, settings.locale]);

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

  const startRename = (projectId: string, currentName: string) => {
    setRenamingId(projectId);
    setRenameDraft(currentName);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      renameProject(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
  };

  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const attentionCount =
    activeProject?.items.filter(
      (i) => i.bom.status === 'inferred_required' || i.bom.match_confidence === 'ambiguous',
    ).length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
              aria-hidden="true"
            >
              <Cpu className="h-3.5 w-3.5" />
            </span>
            <h1 className="m-0 text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              bomTR
            </h1>
            {isExtensionRuntime() && (
              <span className="font-mono-tech text-[10px] text-[var(--text-muted)]">
                v{chrome.runtime.getManifest().version}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <select
              aria-label={t(settings.locale, 'languageLabel')}
              value={settings.locale}
              onChange={(e) => updateSettings({ locale: e.target.value as Locale })}
              className="wb-input font-mono-tech h-7 px-1.5 text-[10px] font-medium"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCALE_LABELS[loc]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setTab('settings')}
              title={
                apiHealth?.online
                  ? `${t(settings.locale, 'apiActive')} (${settings.apiBaseUrl})`
                  : t(settings.locale, 'offline')
              }
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors"
              style={
                apiHealth?.online
                  ? {
                      borderColor: 'var(--status-ok-border)',
                      backgroundColor: 'var(--status-ok-bg)',
                      color: 'var(--status-ok)',
                    }
                  : {
                      borderColor: 'var(--status-warn-border)',
                      backgroundColor: 'var(--status-warn-bg)',
                      color: 'var(--status-warn)',
                    }
              }
            >
              {apiHealth?.online ? (
                <Wifi className="h-3 w-3" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3 w-3" aria-hidden="true" />
              )}
              {apiHealth?.online ? t(settings.locale, 'apiActive') : t(settings.locale, 'offline')}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                settings.theme === 'dark'
                  ? t(settings.locale, 'switchToLight')
                  : t(settings.locale, 'switchToDark')
              }
              title={
                settings.theme === 'dark'
                  ? t(settings.locale, 'themeLight')
                  : t(settings.locale, 'themeDark')
              }
              className="wb-btn-ghost inline-flex h-7 w-7 items-center justify-center"
            >
              {settings.theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto px-3 pb-2"
          aria-label="BOM projeleri"
        >
          {projects.map((p) => {
            const active = p.id === activeProjectId;
            const isRenaming = renamingId === p.id;

            if (isRenaming) {
              return (
                <form
                  key={p.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitRename();
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--bg-input)] px-1.5 py-0.5"
                >
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={commitRename}
                    autoFocus
                    aria-label="Proje adını düzenle"
                    className="w-28 bg-transparent text-[11px] text-[var(--text-primary)] outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Proje adını kaydet"
                    className="text-[var(--accent)]"
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </button>
                </form>
              );
            }

            return (
              <div
                key={p.id}
                className="inline-flex shrink-0 items-center rounded-[var(--radius-sm)] border text-[11px] transition-colors"
                style={
                  active
                    ? {
                        borderColor: 'var(--accent-border)',
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--text-primary)',
                      }
                    : {
                        borderColor: 'var(--border-subtle)',
                        backgroundColor: 'var(--bg-canvas)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                <button
                  type="button"
                  onClick={() => selectProject(p.id)}
                  onDoubleClick={() => startRename(p.id, p.name)}
                  className="inline-flex items-center gap-1.5 px-2 py-1 font-medium whitespace-nowrap"
                >
                  <span className="max-w-[120px] truncate">{p.name}</span>
                  <span className="font-mono-tech tabular-nums text-[10px] text-[var(--text-muted)]">
                    {p.items.length}
                  </span>
                </button>
                {active && (
                  <button
                    type="button"
                    onClick={() => startRename(p.id, p.name)}
                    aria-label={`${p.name} projesini yeniden adlandır`}
                    title="Yeniden adlandır"
                    className="px-1 py-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                )}
                {projects.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteProject(p.id)}
                    aria-label={`${p.name} projesini sil`}
                    title="Projeyi sil"
                    className="pr-1.5 py-1 text-[var(--text-muted)] hover:text-[var(--status-err)]"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => createProject(`BOM #${projects.length + 1}`)}
            aria-label="Yeni BOM projesi oluştur"
            title="Yeni BOM projesi"
            className="wb-btn-ghost inline-flex h-6 w-6 shrink-0 items-center justify-center border border-dashed border-[var(--border-strong)]"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>

        <nav
          role="tablist"
          aria-label="Çalışma alanı sekmeleri"
          className="grid grid-cols-5 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]"
        >
          {NAV_TABS.map(({ id, labelKey, icon: Icon }) => {
            const active = tab === id;
            const label = t(settings.locale, labelKey);
            return (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                }}
              >
                <span className="relative inline-flex items-center">
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: active ? 'var(--accent)' : 'currentColor' }}
                    aria-hidden="true"
                  />
                  {id === 'bom' && attentionCount > 0 && (
                    <span
                      className="ml-1 font-mono-tech tabular-nums text-[9px] font-semibold"
                      style={{ color: 'var(--status-warn)' }}
                    >
                      {attentionCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
                {active && (
                  <span
                    className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="mx-3 mt-2.5 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 py-2 text-[11px] text-[var(--text-primary)]"
        >
          <span className="min-w-0 leading-snug">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Bildirimi kapat"
            className="wb-btn-ghost shrink-0 p-0.5"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <main
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="flex-1 p-3"
      >
        {!hydrated ? (
          <div className="wb-card p-4 text-xs text-[var(--text-muted)]">
            {t(settings.locale, 'loadingWorkspace')}
          </div>
        ) : (
          <>
            {tab === 'bom' && <BomTab />}
            {tab === 'capture' && <CaptureCompareTab />}
            {tab === 'cart' && <CartTab />}
            {tab === 'bridge' && <BridgeTab />}
            {tab === 'settings' && <SettingsTab />}
          </>
        )}
      </main>
    </div>
  );
}
