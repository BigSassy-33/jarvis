---
name: JARVIS Frontend
description: Rules for the React/Vite/Three.js browser face.
applyTo: "src/**/*.{ts,tsx}"
---

- Preserve the existing JARVIS face and interaction model unless the requirement explicitly changes it.
- Keep UI state changes local and typed.
- Reuse existing config, TTS, WebSocket, and audio abstractions.
- Do not hardcode provider secrets in browser code.
- Preserve Executive/Alert voice-role semantics.
- Avoid broad dependency additions for small UI changes.
- Run the TypeScript/Vite build after meaningful frontend changes.
