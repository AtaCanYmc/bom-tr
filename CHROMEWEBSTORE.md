# Chrome Web Store Listing | bomTR

> Last Updated: 2026-11-23

## Store Listing

**Extension Name** [REQUIRED]
bomTR

**Short Description** [REQUIRED]
Manage electronics BOM lists in Chrome Side Panel and compare prices across 6 Turkish component stores with single vs split carts.

**Detailed Description** [REQUIRED]
bomTR helps hardware engineers, makers, and robotics students organize Bills of Materials (BOM) directly in the Chrome Side Panel and compare component prices across six Turkish electronics stores.

Key features:
Manage multiple BOM projects in one workspace with quick add, inline editing, quantity tracking, and review filters.
Capture product title, price, stock status, and SKU directly from Robotistan, Robolink Market, Robo90, Direnç.net, Motorobit, and Robot Sepeti product pages.
Right-click any selected part name or open store page to add it straight to your active BOM.
Compare single-store vs split-store cart totals including shipping thresholds, with per-project currency and free-shipping threshold overrides.
Import and export strict 10-field BOM JSON, Markdown, CSV, KiCad CSV, and EasyEDA CSV files.
Works offline without a backend server using staggered 6-store search tabs, or connects to your own local or LAN robo-api server for live comparisons.
Available in Turkish, English, French, German, and Spanish with light and dark themes.

How to use:
1. Click the bomTR toolbar icon (or press Ctrl+Shift+B / Cmd+Shift+B) to open the Side Panel.
2. Add components manually, import a JSON/KiCad/EasyEDA BOM file in the Bridge tab, or capture parts from any of the 6 supported Turkish electronics stores.
3. Review and approve ambiguous matches before locking selections.
4. Run Cart Comparison to evaluate single-store vs split-store totals and open product tabs in controlled batches.

Privacy and permissions:
All BOM projects and settings stay stored locally on your device. No analytics or tracking are included. Prices and stock signals are shown as query-time evidence only, and the extension never automates checkout or places orders.

Support and source code:
https://github.com/AtaCanYmc/bom-tr/issues

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Manage electronics Bills of Materials (BOM) in the browser Side Panel and compare component prices across six Turkish electronics stores.

**Primary Language** [REQUIRED]
Turkish (with built-in English, French, German, and Spanish UI)

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
| :--- | :--- | :--- | :--- |
| Store Icon [REQUIRED] | 128x128 PNG | Ready | `public/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | Live Chrome Side Panel | Ready | `docs/assets/screenshot-capture.jpg` |
| Screenshot 2 [RECOMMENDED] | Live Chrome Side Panel | Ready | `docs/assets/screenshot-bridge.jpg` |
| Screenshot 3 [RECOMMENDED] | Live Chrome Side Panel | Ready | `docs/assets/screenshot-settings.jpg` |
| Promo Banner 1 | 16:9 JPG | Ready | `docs/assets/banner-hero.jpg` |
| Promo Banner 2 | 16:9 JPG | Ready | `docs/assets/banner-cart.jpg` |
| Promo Banner 3 | 16:9 JPG | Ready | `docs/assets/banner-compare.jpg` |
| Demo Video [RECOMMENDED] | YouTube | Ready | `https://www.youtube.com/watch?v=l9TjYiBdo7w` |

### Screenshot Notes
Capture Chrome with a supported store product page open on the left and the `bomTR` Side Panel open on the right at 1280x800. Include one light-theme shot and one dark-theme shot.

## Permissions Justification

| Permission | Type | Justification |
| :--- | :--- | :--- |
| `sidePanel` | permissions | Opens the main bomTR workspace in Chrome's Side Panel when the user clicks the toolbar icon, presses the keyboard shortcut, or uses the right-click menu. |
| `storage` | permissions | Saves the user's multi-project BOM lists, candidate price evidence, language, theme, and shipping threshold overrides locally on their device. |
| `contextMenus` | permissions | Adds the "bomTR: BOM'a Ekle" right-click menu action so users can send selected component names or open store product pages directly into their active BOM. |
| `activeTab` | permissions | Grants temporary access to the active tab strictly when the user clicks the right-click menu action, avoiding broad tab access permissions. |
| `https://www.robotistan.com/*` | host_permissions | Reads public product title, price, stock text, and SKU on Robotistan product pages when the user triggers a page capture. |
| `https://www.robolinkmarket.com/*` | host_permissions | Reads public product title, price, stock text, and SKU on Robolink Market product pages when the user triggers a page capture. |
| `https://www.robo90.com/*` | host_permissions | Reads public product title, price, stock text, and SKU on Robo90 product pages when the user triggers a page capture. |
| `https://www.direnc.net/*` | host_permissions | Reads public product title, price, stock text, and SKU on Direnç.net product pages when the user triggers a page capture. |
| `https://www.motorobit.com/*` | host_permissions | Reads public product title, price, stock text, and SKU on Motorobit product pages when the user triggers a page capture. |
| `https://www.robotsepeti.com/*` | host_permissions | Reads public product title, price, stock text, and SKU on Robot Sepeti product pages when the user triggers a page capture. |
| `http://127.0.0.1/*`, `http://localhost/*` | host_permissions | Connects to the user's optional local `robo-api` server to run live component searches and cart comparisons. |
| `http://*/*`, `https://*/*` | optional_host_permissions | Never requested at install time. Used only when the user manually enters a custom LAN or Tailscale `robo-api` URL in Settings and clicks "Save & Test" to request scoped single-origin access. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No (all BOM projects and preferences stay in local browser storage; optional API calls transmit only sanitized component search queries and item quantities to the user-configured `robo-api` host).

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [REQUIRED]
https://github.com/AtaCanYmc/bom-tr/blob/main/docs/privacy.md

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** [REQUIRED]
AtaCanYmc

**Contact Email** [REQUIRED]
atacanymc@gmail.com

**Support URL / Email** [RECOMMENDED]
https://github.com/AtaCanYmc/bom-tr/issues

**Homepage URL** [RECOMMENDED]
https://github.com/AtaCanYmc/bom-tr

## Version History

| Version | Date | Changes | Status |
| :--- | :--- | :--- | :--- |
| 0.1.3 | 2026-11-23 | Security hardening (URL sanitization, MV3 sender checks, CSV formula neutralization), synchronous sidePanel.open gesture fix, 6-store HTML fixture tests, KiCad/EasyEDA CSV import & export, per-project currency/shipping overrides, 5-language i18n (TR/EN/FR/DE/ES), light/dark OKLCH UI redesign, keyboard shortcut. | Draft |
| 0.1.2 | 2026-11-23 | CI Makefile portability fix, governance docs, initial MV3 release package. | Draft |

## Review Notes

### Known Issues / Limitations
- `optional_host_permissions` (`http://*/*`, `https://*/*`) are strictly optional and only requested for the exact single origin entered by the user in Settings (e.g. `http://192.168.1.20:8000/*`).
- The extension works fully offline when `robo-api` is not running; reviewers can test BOM editing, KiCad/EasyEDA/JSON import-export, store page capture on the 6 supported domains, and staggered 6-store search tabs without any backend server.
