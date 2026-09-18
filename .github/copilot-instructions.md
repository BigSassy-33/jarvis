# TITAN / JARVIS Copilot Instructions

Follow the repository-wide engineering contract in [AGENTS.md](../AGENTS.md).

For every implementation task:
- inspect before editing;
- preserve existing architecture and public behavior;
- use narrow adapters for external services;
- never invent undocumented API endpoints;
- never hardcode secrets;
- validate changes before completion;
- do not call an integration live unless its endpoint and credentials are actually configured;
- distinguish configured, reachable, healthy, and verified states;
- keep commits focused and reviewable.

When changing voice behavior, preserve the Executive/Alert role routing and server-side ElevenLabs secret handling.
