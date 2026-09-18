---
name: TITAN Configuration and Security
description: Security rules for configuration, environment variables, and integration boundaries.
applyTo: "**/*.{json,js,mjs,ts,tsx,md,yml,yaml}"
---

- Never commit secrets, credentials, tokens, private keys, or personal data.
- Environment examples must contain placeholders, never live credentials.
- Remote service URLs must use HTTPS unless the service is explicitly local loopback.
- Do not invent API endpoints or authentication schemes.
- Configuration should distinguish optional integrations from required runtime dependencies.
- Health endpoints must not expose secret values.
