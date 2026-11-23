import { AlertCircle, Check, Copy, Download, FileUp } from 'lucide-react';
import { useState } from 'react';
import {
  exportBomAsCsv,
  exportBomAsEasyedaCsv,
  exportBomAsJson,
  exportBomAsKicadCsv,
  exportBomAsMarkdown,
  parseBomCsv,
} from '../../shared/exporters';
import { t } from '../../shared/i18n';
import { parseAndValidateBomJson, type ValidationIssue } from '../../shared/validator';
import { useWorkspaceStore } from '../store';

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BridgeTab() {
  const { projects, activeProjectId, settings, importItems, setNotice } = useWorkspaceStore();
  const [rawInput, setRawInput] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append' | 'new_project'>('replace');
  const [newProjectName, setNewProjectName] = useState('');
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);
  if (!project) return null;

  const loc = settings.locale;
  const slug =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'bom';

  const handleValidateAndImport = (text = rawInput) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const result = parseAndValidateBomJson(trimmed);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setErrors([]);
      importItems(result.items, importMode, newProjectName.trim() || undefined);
      setNotice(`${result.items.length} BOM items imported (JSON).`);
      return;
    }

    const csvRes = parseBomCsv(trimmed);
    if (!csvRes.ok) {
      setErrors([{ index: -1, field: 'csv', message: csvRes.error ?? 'Invalid CSV' }]);
      return;
    }
    const validated = parseAndValidateBomJson(JSON.stringify(csvRes.items));
    if (!validated.ok) {
      setErrors(validated.errors);
      return;
    }
    setErrors([]);
    importItems(validated.items, importMode, newProjectName.trim() || undefined);
    setNotice(`${validated.items.length} BOM items imported (${csvRes.format?.toUpperCase()} CSV).`);
  };

  const handleFile = async (file: File) => {
    const content = await file.text();
    setRawInput(content);
    handleValidateAndImport(content);
  };

  const handleCopy = async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFormat(label);
      setTimeout(() => setCopiedFormat(null), 1500);
    } catch {
      setNotice('Clipboard copy failed.');
    }
  };

  const exportFormats = [
    {
      key: 'json',
      label: 'JSON (10-field)',
      get: () => exportBomAsJson(project.items),
      ext: 'json',
      mime: 'application/json',
    },
    {
      key: 'md',
      label: 'Markdown',
      get: () => exportBomAsMarkdown(project.name, project.items),
      ext: 'md',
      mime: 'text/markdown',
    },
    {
      key: 'csv',
      label: 'CSV (10-field)',
      get: () => exportBomAsCsv(project.items),
      ext: 'csv',
      mime: 'text/csv',
    },
    {
      key: 'kicad',
      label: 'KiCad CSV',
      get: () => exportBomAsKicadCsv(project.items),
      ext: 'kicad.csv',
      mime: 'text/csv',
    },
    {
      key: 'easyeda',
      label: 'EasyEDA CSV',
      get: () => exportBomAsEasyedaCsv(project.items),
      ext: 'easyeda.csv',
      mime: 'text/csv',
    },
  ];

  return (
    <div className="space-y-3 text-xs">
      <section className="wb-card space-y-2.5 p-3">
        <div>
          <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
            {t(loc, 'importTitle')}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t(loc, 'importDesc')}</p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed p-3.5 text-center transition-colors"
          style={
            dragging
              ? {
                  borderColor: 'var(--accent)',
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--text-primary)',
                }
              : {
                  borderColor: 'var(--border-strong)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-muted)',
                }
          }
        >
          <FileUp className="mb-1.5 h-4 w-4" aria-hidden="true" />
          <span className="text-[11px]">{t(loc, 'dropHint')}</span>
          <label className="wb-btn-secondary mt-2 inline-block px-2.5 py-1 text-[11px]">
            {t(loc, 'chooseFile')}
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="block text-[10px] text-[var(--text-muted)]">
            {t(loc, 'payloadLabel')}
          </span>
          <textarea
            rows={5}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder='[{"raw_name": "ESP32", ...}]  or  Reference,Value,Footprint,Qty'
            className="wb-input font-mono-tech w-full p-2 text-[11px]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label={t(loc, 'importTitle')}
            value={importMode}
            onChange={(e) =>
              setImportMode(e.target.value as 'replace' | 'append' | 'new_project')
            }
            className="wb-input px-2 py-1.5 text-[11px]"
          >
            <option value="replace">{t(loc, 'modeReplace')}</option>
            <option value="append">{t(loc, 'modeAppend')}</option>
            <option value="new_project">{t(loc, 'modeNewProject')}</option>
          </select>

          {importMode === 'new_project' && (
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              aria-label={t(loc, 'projectNamePlaceholder')}
              placeholder={t(loc, 'projectNamePlaceholder')}
              className="wb-input flex-1 px-2 py-1.5 text-[11px]"
            />
          )}

          <button
            type="button"
            disabled={!rawInput.trim()}
            onClick={() => handleValidateAndImport()}
            className="wb-btn-primary ml-auto px-3 py-1.5 text-[11px]"
          >
            {t(loc, 'validateImport')}
          </button>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="space-y-1 rounded-[var(--radius-md)] border p-2.5 text-[11px]"
            style={{
              borderColor: 'var(--status-err-border)',
              backgroundColor: 'var(--status-err-bg)',
              color: 'var(--status-err)',
            }}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(loc, 'schemaErrors')} ({errors.length})
            </div>
            <ul className="max-h-36 list-disc space-y-0.5 overflow-y-auto pl-4">
              {errors.map((err, idx) => (
                <li key={idx}>
                  {err.index >= 0 ? `[#${err.index}] ` : ''}
                  <code className="font-mono-tech">{err.field}</code>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="wb-card space-y-2.5 p-3">
        <div>
          <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
            {t(loc, 'exportTitle')} ({project.items.length} {t(loc, 'itemsUnit')})
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t(loc, 'exportDesc')}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {exportFormats.map((fmt) => (
            <div key={fmt.key} className="wb-inset space-y-2 p-2.5">
              <div className="font-mono-tech text-[11px] font-semibold text-[var(--text-primary)]">
                {fmt.label}
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleCopy(fmt.key, fmt.get())}
                  className="wb-btn-secondary inline-flex flex-1 items-center justify-center gap-1 px-2 py-1 text-[10px]"
                >
                  {copiedFormat === fmt.key ? (
                    <Check
                      className="h-3 w-3"
                      style={{ color: 'var(--status-ok)' }}
                      aria-hidden="true"
                    />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  {copiedFormat === fmt.key ? t(loc, 'copied') : t(loc, 'copy')}
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile(`${slug}.${fmt.ext}`, fmt.get(), fmt.mime)}
                  className="wb-btn-secondary inline-flex flex-1 items-center justify-center gap-1 px-2 py-1 text-[10px]"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  {t(loc, 'download')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
