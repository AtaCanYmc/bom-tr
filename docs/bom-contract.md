[← Dokümantasyon](README.md)

# 10 Alanlı BOM Sözleşmesi

`bomTR`, `bom-sourcing` JSON şemasıyla (`additionalProperties: false`) birebir uyumludur. İçe aktarılan her JSON dizisi `src/shared/validator.ts` tarafından çalışma zamanında doğrulanır.

## Şema Alanları

| Alan | Tip | Kural |
| :--- | :--- | :--- |
| `raw_name` | `string` | Boş olamaz. Kaynaktaki ham ifade. |
| `canonical_name` | `string` | Boş olamaz. Standartlaştırılmış aranabilir parça adı. |
| `quantity` | `number \| null` | `>= 1` tam sayı veya bilinmiyorsa `null`. |
| `status` | `enum` | `confirmed`, `inferred_required` veya `optional_or_assumed`. |
| `source_files` | `string[]` | En az 1 boş olmayan kaynak referansı. |
| `constraints` | `Record<string, unknown>` | Voltaj, protokol, paket veya boyut kısıtları nesnesi. |
| `search_queries` | `string[]` | En az 1 boş olmayan katalog arama terimi. |
| `match_confidence` | `enum` | `exact`, `partial`, `ambiguous` veya `unmatched`. |
| `stock_status` | `enum` | `in_stock`, `low_stock`, `out_of_stock` veya `unknown`. |
| `notes` | `string` | Çakışma, doğrulama gereksinimi ve stok uyarıları. |

## Aday Kanıt Ayrımı

Fiyat, stok, mağaza, URL ve gözlem zamanı (`observedAt`) bilgileri `BomItem` nesnesinin içine yazılmaz. Bu veriler `WorkspaceBomItem.candidates` altında ayrı tutulur.

- JSON dışa aktarımı (`exportBomAsJson`) yalnızca saf 10 alanlı `BomItem[]` dizisi üretir.
- Markdown dışa aktarımı (`exportBomAsMarkdown`) tablo sütununda seçili kanıt özetini gösterir.
- CSV dışa aktarımı (`exportBomAsCsv`) RFC-4180 kaçış kuralları ve formül enjeksiyon korumasıyla 10 sütun üretir.
- KiCad ve EasyEDA CSV içe/dışa aktarımı (`parseBomCsv`, `exportBomAsKicadCsv`, `exportBomAsEasyedaCsv`) CAD tablolarını 10 alanlı sözleşmeye eşler.

## Eşleşme Onay Kilidi

`partial` veya `ambiguous` güven düzeyindeki bir kalem, kullanıcı açıkça **Onayla** düğmesine basmadan kesin seçime (`selectionLocked: true` ve `match_confidence: "exact"`) kilitlenmez. Güven düzeyi elle düşürüldüğünde kilit otomatik açılır.
