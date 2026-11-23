# Privacy Policy for bomTR

Last updated: 2026-11-23

## Overview

`bomTR` is a local-first Chrome Side Panel extension for managing electronic Bills of Materials (BOM) and comparing component prices across six Turkish electronics stores.

## What Data Is Stored Locally

All workspace data stays inside your browser's local storage (`chrome.storage.local`):

- BOM project lists, item names, quantities, status flags, notes, and observed price/stock candidates.
- User preferences: appearance theme (light/dark), interface language (`tr`, `en`, `fr`, `de`, `es`), delivery destination, default currency, per-project currency and free-shipping threshold overrides, staggered tab delay, and custom `robo-api` URL.

No cookies, analytics, crash reporters, or third-party tracking scripts are used.

## What Data Leaves Your Device

By default, no data leaves your device.

When you explicitly run an API search or cart comparison, `bomTR` sends only:

- Sanitized component search queries (e.g. `ESP32-WROOM-32`)
- Requested item quantities

These requests are sent strictly to the `robo-api` endpoint configured by you (default: `http://127.0.0.1:8000`, or a custom LAN/Tailscale URL that you explicitly authorize via Chrome's per-origin permission prompt).

`bomTR` never reads or transmits local project source files, credentials, `.env` files, payment details, or unrelated browser tabs.

## Supported Store Pages

Content reading runs exclusively on the six declared Turkish electronics store domains (`robotistan.com`, `robolinkmarket.com`, `robo90.com`, `direnc.net`, `motorobit.com`, `robotsepeti.com`) and only reads public product metadata (title, price, stock text, SKU) when you trigger a capture. The extension never automates checkout or submits orders.

## Data Sharing

`bomTR` does not sell, rent, or share user data with any third party.

## Data Retention and Deletion

Your BOM projects and settings remain stored locally in your browser until you delete individual projects, clear extension storage, or uninstall the extension. You can export your BOM lists at any time as JSON, Markdown, CSV, KiCad CSV, or EasyEDA CSV.

## Changes to This Policy

Policy updates are tracked in this repository's git history and release notes.

## Contact

For privacy questions or security reports, open a private report on the `AtaCanYmc/bom-tr` repository Security tab or contact `atacanymc@gmail.com`.
