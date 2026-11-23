[← Dokümantasyon](README.md)

# robo-api ve Offline Fallback

`bomTR`, yerel veya LAN üzerindeki bir `robo-api` örneğiyle HTTP üzerinden konuşur. API kapalıyken yerel BOM düzenleme ve mağaza arama sekmeleri kesintisiz çalışır.

## Desteklenen Uç Noktalar

| İşlem | Birincil Uç Nokta | Uyumluluk Fallback |
| :--- | :--- | :--- |
| Sağlık kontrolü | `GET /api/v1/health` | `GET /health` |
| Tekli parça arama | `POST /api/v1/search` | `GET /api/v1/search?q=...&limit=...` |
| Toplu parça arama | `POST /api/v1/search/batch` | Yerel aday kanıtları |
| Sepet optimizasyonu | `POST /api/v1/cart/optimize` | `POST /api/v1/optimize` + istemci senaryo hesabı |

## Desteklenen 6 Mağaza ve Offline Arama URL'leri

| Mağaza Kimliği | Alan Adı | Offline Arama Şablonu | Varsayılan Kargo | Ücretsiz Kargo Eşiği |
| :--- | :--- | :--- | :---: | :---: |
| `robotistan` | `www.robotistan.com` | `https://www.robotistan.com/arama?q={query}` | 34.90 TL | 1500 TL |
| `robolink` | `www.robolinkmarket.com` | `https://www.robolinkmarket.com/arama?q={query}` | 39.90 TL | 1500 TL |
| `robo90` | `www.robo90.com` | `https://www.robo90.com/arama?q={query}` | 39.90 TL | 1500 TL |
| `direncnet` | `www.direnc.net` | `https://www.direnc.net/arama?q={query}` | 29.90 TL | 1500 TL |
| `motorobit` | `www.motorobit.com` | `https://www.motorobit.com/arama?q={query}` | 39.90 TL | 1500 TL |
| `robotsepeti` | `www.robotsepeti.com` | `https://www.robotsepeti.com/arama?q={query}` | 39.90 TL | 1500 TL |

Kargo ücretleri ve ücretsiz kargo eşikleri varsayılan tahminlerdir. Sipariş öncesinde mağaza sepet ekranında doğrulanmalıdır.

## Özel Tailscale / LAN API Adresi

Varsayılan adres `http://127.0.0.1:8000` değeridir. **Ayar** sekmesinde farklı bir LAN veya Tailscale adresi girilip **Kaydet & Test** düğmesine tıklandığında, `chrome.permissions.request` yalnızca o origin için (`optional_host_permissions`) kullanıcı onayı ister.
