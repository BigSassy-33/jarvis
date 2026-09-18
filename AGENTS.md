# TITAN / JARVIS Repository Operating Rules

## Mission
This repository is the production-oriented JARVIS face, bridge, and integration shell for Project TITAN. Preserve existing working behavior while extending the system incrementally.

## Non-negotiable rules
- Inspect existing code and configuration before editing.
- Prefer the smallest coherent change that satisfies the requirement.
- Never create disposable demos, mock implementations, placeholder integrations, or parallel rewrites when an existing implementation can be extended.
- Never copy source code from external projects into this repository unless explicitly authorized. Integrate external projects through documented APIs, MCP, or process boundaries.
- Never commit API keys, tokens, OAuth secrets, private certificates, or personal credentials.
- Secrets belong in environment variables or the platform's secret store.
- Never modify upstream repositories. Work only in the user's fork/branch.
- Do not silently change locked architecture, voice IDs, provider routing, or public behavior.
- Preserve backward compatibility unless a breaking change is explicitly required.
- Verify changes with the narrowest relevant tests, then run project validation before declaring completion.
- If a required external service is unavailable, implement a safe adapter boundary and explicit unavailable state; do not fake a successful connection.
- Record architectural decisions in docs when they affect future implementation.

## Current architecture
- Browser face/UI: React + Vite + Three.js.
- Local bridge: Node.js at port 8787.
- Face dev server: port 5173.
- Voice provider abstraction: VoiceStudio local-first with ElevenLabs fallback.
- Executive voice: `tVb4QGWh6bdIXHLleu7W`.
- Alert voice: `CwhRBWXzGAHq8TQ4Fs17`.
- ElevenLabs API key is server-side only.
- VoiceStudio remains an external service; do not vendor its AGPL source.
- TITAN integrations are service boundaries, not claims that every service is already installed or connected.

## Delivery protocol
1. Inspect.
2. Plan the smallest change.
3. Implement.
4. Validate syntax/tests/build.
5. Inspect the diff.
6. Report exactly what changed and what could not be verified.
