# Contributing to bomTR

## Development Setup

```bash
make install
make verify
```

Load the generated `dist/` directory in Chrome via `chrome://extensions` with **Developer mode** enabled.

## Commit Format

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) to drive automated versioning via `release-please`:

- `feat:` new user-facing capability (bumps minor pre-1.0 or minor)
- `fix:` bug fix (bumps patch)
- `docs:` documentation-only changes
- `refactor:` internal restructuring without behavior changes
- `chore:` build, tooling, or maintenance updates

## Pull Request Checklist

Before opening a pull request, run:

```bash
make verify
```

Verify that:

1. `package.json`, `public/manifest.json`, and `.release-please-manifest.json` versions stay aligned (`make check-version`).
2. `public/manifest.json` preserves minimum MV3 permissions and never introduces `<all_urls>`.
3. Pure JSON export (`exportBomAsJson`) remains strictly compliant with the 10-field `bom-sourcing` schema.
4. Any new store adapter degrades gracefully with `partial: true` and `missingFields` instead of fabricating values.
