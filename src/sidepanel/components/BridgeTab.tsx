import { AlertCircle, Check, Copy, Download, FileUp } from 'lucide-react';
import { useState } from 'react';
import { exportBomAsCsv, exportBomAsJson, exportBomAsMarkdown } from '../../shared/exporters';
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
  const { projects, activeProjectId, importItems, setNotice } = useWorkspaceStore();
  const [rawJson, setRawJson] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append' | 'new_project'>('replace');
  const [newProjectName, setNewProjectName] = useState('');
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);
  if (!project) return null;

  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bom';

  const handleValidateAndImport = (text = rawJson) => {
    const result = parseAndValidateBomJson(text);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    importItems(result.items, importMode, newProjectName.trim() || undefined);
    setNotice(`${result.items.length} BOM kalemi doğrulandı ve içe aktarıldı.`);
  };

  const handleFile = async (file: File) => {
    const content = await file.text();
    setRawJson(content);
    handleValidateAndImport(content);
  };

  const handleCopy = async (label: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedFormat(label);
    setTimeout(() => setCopiedFormat(null), 1500);
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
        <div className="font-medium text-slate-100">bom-sourcing JSON İçe Aktar</div>

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
          className={`flex flex-col items-center justify-center rounded-md border border-dashed p-3 text-center transition ${
            dragging
              ? 'border-sky-400 bg-sky-950/30 text-sky-200'
              : 'border-slate-700 bg-slate-950/60 text-slate-400'
          }`}
        >
          <FileUp className="mb-1 h-4 w-4" />
          <span className="text-[11px]">.json dosyasını sürükleyip bırakın veya seçin</span>
          <label className="mt-1.5 cursor-pointer rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700">
            Dosya Seç
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </div>

        <textarea
          rows={6}
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          placeholder='[{"raw_name": "...", "canonical_name": "...", ...}]'
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={importMode}
            onChange={(e) =>
              setImportMode(e.target.value as 'replace' | 'append' | 'new_project')
            }
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
          >
            <option value="replace">Aktif BOM&apos;un üzerine yaz</option>
            <option value="append">Aktif BOM&apos;a ekle</option>
            <option value="new_project">Yeni proje sekmesi aç</option>
          </select>

          {importMode === 'new_project' && (
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Proje adı"
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px]"
            />
          )}

          <button
            type="button"
            disabled={!rawJson.trim()}
            onClick={() => handleValidateAndImport()}
            className="ml-auto rounded bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Doğrula & İçe Aktar
          </button>
        </div>

        {errors.length > 0 && (
          <div className="space-y-1 rounded border border-rose-500/40 bg-rose-950/30 p-2 text-[11px] text-rose-200">
            <div className="flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Şema Doğrulama Hataları ({errors.length})
            </div>
            <ul className="max-h-36 space-y-0.5 overflow-y-auto pl-4 list-disc">
              {errors.map((err, idx) => (
                <li key={idx}>
                  {err.index >= 0 ? `[#${err.index}] ` : ''}
                  <code>{err.field}</code>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
        <div className="font-medium text-slate-100">Dışa Aktar ({project.items.length} kalem)</div>
        <div className="text-[11px] text-slate-400">
          JSON çıktısı yalnızca 10 alanlı <code>bom-sourcing</code> sözleşmesini içerir.
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            {
              key: 'json',
              label: 'JSON',
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
              label: 'CSV',
              get: () => exportBomAsCsv(project.items),
              ext: 'csv',
              mime: 'text/csv',
            },
          ].map((fmt) => (
            <div key={fmt.key} className="space-y-1 rounded border border-slate-800 bg-slate-950/70 p-2">
              <div className="text-center font-medium text-slate-200">{fmt.label}</div>
              <div className="flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => void handleCopy(fmt.key, fmt.get())}
                  className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700"
                >
                  {copiedFormat === fmt.key ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Kopyala
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile(`${slug}.${fmt.ext}`, fmt.get(), fmt.mime)}
                  className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700"
                >
                  <Download className="h-3 w-3" />
                  İndir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
