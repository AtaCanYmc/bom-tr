# bomTR

Türkçe | [English](README.en.md)

10 alanlı `bom-sourcing` BOM (Bill of Materials) şemasını yönetmek ve Türkiye'deki 6 elektronik bileşen mağazasında `robo-api` veya çevrimdışı `?q=...` aramasıyla fiyat/stok kıyaslamak için Manifest V3 Chrome Side Panel eklentisi.

## Mimari

```mermaid
flowchart LR
    SP["Side Panel Arayüzü\nReact 19 + Zustand"] <-->|"chrome.runtime.sendMessage"| SW["Service Worker\nsrc/background/"]
    SW <-->|"chrome.storage.local"| ST["Kalıcı BOM Projeleri"]
    SW -->|"GET/POST /api/v1/*"| API["robo-api\n127.0.0.1:8000 veya LAN"]
    SW <-->|"READ_PRODUCT_PAGE"| CS["Content Script\n6 Mağaza DOM Adaptörü"]
    SW -->|"chrome.tabs.create\nkademeli"| TABS["Mağaza Sekmeleri / ?q= Fallback"]
```

## Hızlı Başlangıç

```bash
make install
make verify
```

### Chrome'da Yükleme (`Load unpacked`)

1. `dist/` çıktısını üretmek için `make build` (veya `npm run build`) çalıştırın.
2. Chrome'da `chrome://extensions` sayfasını açın ve **Geliştirici modu**nu etkinleştirin.
3. **Paketlenmemiş öğe yükle** (`Load unpacked`) düğmesine tıklayıp `dist/` klasörünü seçin.
4. Araç çubuğundaki **bomTR** ikonuna tıklayarak Side Panel çalışma alanını açın.

## Depo Yapısı

```text
bom-tr/
├── .github/workflows/
│   └── release-please.yml    # Otomatik sürümleme ve Chrome ZIP sürüm yüklemesi
├── public/
│   ├── icons/                # 16px, 48px, 128px eklenti ikonları
│   └── manifest.json         # Minimum izinli Manifest V3 tanımı
├── src/
│   ├── background/
│   │   ├── index.ts          # Service worker, sağ tık menüsü, badge, kademeli sekme açıcı
│   │   ├── roboApi.ts        # robo-api HTTP istemcisi ve tek/bölünmüş sepet hesaplayıcı
│   │   └── storageKeys.ts    # chrome.storage.local anahtar sabitleri
│   ├── content/
│   │   ├── adapters.ts       # 6 Türk mağazası için izole DOM adaptörleri
│   │   ├── index.ts          # Content script mesaj dinleyicisi
│   │   └── parser.ts         # JSON-LD okuyucu, TL fiyat ayrıştırıcı, stok sınıflandırıcı
│   ├── shared/
│   │   ├── bom.ts            # 10 alanlı BomItem sözleşmesi, aday kanıt ve proje tipleri
│   │   ├── exporters.ts      # Saf 10 alan JSON, Markdown ve CSV dışa aktarıcılar
│   │   ├── messages.ts       # Tipli eklenti mesaj sözleşmeleri
│   │   ├── stores.ts         # 6 mağaza tanımı, kargo varsayılanları, ?q= URL üreticileri
│   │   └── validator.ts      # Çalışma zamanı 10 alan bom-sourcing JSON doğrulayıcısı
│   └── sidepanel/
│       ├── components/       # BomTab, CaptureCompareTab, CartTab, BridgeTab, SettingsTab
│       ├── App.tsx           # Side panel kabuğu ve çoklu proje sekmeleri
│       ├── chromeBridge.ts   # Tipli chrome.* runtime, storage ve origin izin sarmalayıcısı
│       ├── index.css         # Tailwind CSS giriş dosyası
│       ├── main.tsx          # React 19 giriş noktası
│       └── store.ts          # chrome.storage.local kalıcılıklı Zustand store
├── tests/
│   └── bom.test.ts           # Node yerleşik test koşucusu ile şema, parser ve sepet testleri
├── .release-please-manifest.json
├── Makefile
├── release-please-config.json
├── sidepanel.html
├── tsconfig.json
├── vite.config.ts
└── vite.content.config.ts
```

## İzinler ve Gizlilik Sınırı

| İzin / Alan Adı | Amaç |
| :--- | :--- |
| `sidePanel` | Araç çubuğu tıklaması ve sağ tık menüsüyle bomTR çalışma alanını açar. |
| `storage` | Çoklu proje BOM verilerini ve ayarları `chrome.storage.local` üzerinde saklar. |
| `contextMenus` | Seçili metin ve ürün sayfaları için "bomTR: BOM'a Ekle" sağ tık aksiyonunu ekler. |
| `activeTab` | Geniş sekme izni olmadan yalnızca sağ tık aksiyonunda geçici sekme erişimi sağlar. |
| 6 mağaza alan adı | Robotistan, Robolink Market, Robo90, Direnç.net, Motorobit ve Robot Sepeti üzerinde kısıtlı DOM okuma. |
| `http://127.0.0.1/*`, `http://localhost/*` | Yerel `robo-api` sunucusuna bağlanır. Özel Tailscale/LAN adresleri için `optional_host_permissions` ile yalnızca ilgili origin izni istenir. |

`robo-api` servisine yalnızca temizlenmiş parça arama terimleri ve BOM kalem adetleri gönderilir. Proje dosyaları, kimlik bilgileri veya ilgisiz sayfa içerikleri asla gönderilmez.

## Doğrulama ve Paketleme

```bash
make typecheck     # TypeScript strict tip kontrolü
make test          # Şema doğrulama, exporter, fiyat ayrıştırıcı ve sepet hesap testleri
make build         # dist/ altına üretim MV3 derlemesi
make release-dry   # Tam doğrulama + Chrome ZIP arşivi ve SHA256SUMS
```
