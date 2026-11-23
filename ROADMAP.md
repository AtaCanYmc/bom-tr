# Roadmap

Milestones are grouped by release target. Scope is constrained to verifiable engineering deliverables.

## v0.1.0 (Current)

- Manifest V3 Chrome Side Panel workspace built with React 19, TypeScript, Tailwind CSS, and Zustand.
- Strict 10-field `bom-sourcing` JSON validator and pure JSON, Markdown, and CSV exporters.
- Isolated DOM capture adapters for 6 Turkish electronics stores (`robotistan`, `robolink`, `robo90`, `direncnet`, `motorobit`, `robotsepeti`).
- Local and LAN `robo-api` integration with single-store vs split-store cart calculation and offline `?q=` search fallback.
- Automated `release-please` versioning with Chrome ZIP packaging and `SHA256SUMS.txt` uploads.

## v0.2.0 (Completed on `main`)

- [x] DOM adapter fixture tests for all 6 supported stores using saved HTML snapshots (`tests/fixtures/*.html`).
- [x] Export and import support for KiCad and EasyEDA CSV BOM tables mapped into the 10-field contract.
- [x] Per-project currency and shipping threshold overrides persisted in `chrome.storage.local`.
- [x] Multi-language UI localization (`tr`, `en`, `fr`, `de`, `es`) and light/dark OKLCH theme toggle.
- [x] Chrome Web Store listing (`CHROMEWEBSTORE.md`) and privacy policy (`docs/privacy.md`).

## v0.3.0

- Historical price observation log per candidate to highlight price deltas across queries.
- Keyboard navigation shortcuts inside the Side Panel BOM table and quick-add modal.
- Chrome Web Store publishing pipeline with automated privacy policy and permission checks.
