# Security Policy

## Supported Versions

| Version | Supported |
| :--- | :---: |
| `0.1.x` | Yes |

## Privacy and Data Boundary

`bomTR` enforces a strict local-first boundary:

- Only sanitized component search queries and BOM item quantities are sent to the configured `robo-api` endpoint.
- Project source files, credentials, `.env` values, and unrelated browser tab contents are never read or transmitted.
- Content scripts run exclusively on the 6 declared Turkish electronics store domains.
- `<all_urls>` is never requested. Custom LAN or Tailscale API endpoints use `optional_host_permissions` and request scoped per-origin access only on explicit user click.
- Observed prices and stock signals are presented as query-time evidence only. The extension never automates checkout or submits orders.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Use GitHub Private Vulnerability Reporting on the `AtaCanYmc/bom-tr` repository Security tab, or contact the maintainer privately with:

1. Affected version and reproduction steps.
2. Impact assessment (for example, host permission scope, storage exposure, or XSS in the side panel).
3. Any suggested patch or mitigation.

Initial acknowledgement target is 48 hours.
