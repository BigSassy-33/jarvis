---
name: JARVIS Bridge
description: Rules for the Node bridge and external service adapters.
applyTo: "bridge/**/*.mjs"
---

- Keep bridge modules small and explicit.
- Validate and normalize external inputs.
- Keep secrets server-side.
- External integrations must fail safely and expose explicit unavailable/error states.
- Use documented endpoints only.
- Keep local services on loopback by default; require HTTPS for deliberately remote endpoints.
- Preserve provider fallback behavior.
- Do not grant arbitrary shell/file/device access merely to simplify an integration.
- Run node --check on changed bridge modules and npm run build after bridge changes.
