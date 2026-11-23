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
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFormat(label);
      setTimeout(() => setCopiedFormat(null), 1500);
    } catch {
      setNotice('Panoya kopyalama başarısız. İndir düğmesini kullanabilirsiniz.');
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <section className="wb-card space-y-2.5 p-3">
        <div>
          <h2 className="m-0 text-[13px] font-semibold text-[var(--text-primary)]">
            bom-sourcing JSON İçe Aktar
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            10 alanlı şema doğrulanır; bilinmeyen alan içeren kayıtlar reddedilir.
          </p>
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
          <span className="text-[11px]">.json dosyasını sürükleyip bırakın veya seçin</span>
          <label className="wb-btn-secondary mt-2 inline-block px-2.5 py-1 text-[11px]">
            Dosya Seç
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="block text-[10px] text-[var(--text-muted)]">JSON İçeriği</span>
          <textarea
            rows={5}
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            placeholder='[{"raw_name": "ESP32", "canonical_name": "ESP32-WROOM-32", ...}]'
            className="wb-input font-mono-tech w-full p-2 text-[11px]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="İçe aktarma modu"
            value={importMode}
            onChange={(e) =>
              setImportMode(e.target.value as 'replace' | 'append' | 'new_project')
            }
            className="wb-input px-2 py-1.5 text-[11px]"
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
              aria-label="Yeni proje adı"
              placeholder="Proje adı"
              className="wb-input flex-1 px-2 py-1.5 text-[11px]"
            />
          )}

          <button
            type="button"
            disabled={!rawJson.trim()}
            onClick={() => handleValidateAndImport()}
            className="wb-btn-primary ml-auto px-3 py-1.5 text-[11px]"
          >
            Doğrula &amp; İçe Aktar
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
              Şema Doğrulama Hataları ({errors.length})
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
            Dışa Aktar ({project.items.length} kalem)
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            JSON çıktısı yalnızca saf 10 alanlı <code className="font-mono-tech">bom-sourcing</code>{' '}
            sözleşmesini üretir.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
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
            <div key={fmt.key} className="wb-inset space-y-2 p-2.5 text-center">
              <div className="font-mono-tech text-[11px] font-semibold text-[var(--text-primary)]">
                {fmt.label}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => void handleCopy(fmt.key, fmt.get())}
                  className="wb-btn-secondary inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px]"
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
                  {copiedFormat === fmt.key ? 'Kopyalandı' : 'Kopyala'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile(`${slug}.${fmt.ext}`, fmt.get(), fmt.mime)}
                  className="wb-btn-secondary inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px]"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  İndir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
