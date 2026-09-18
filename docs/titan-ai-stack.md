# TITAN AI Stack Integration

This branch integrates the selected open-source projects as external capabilities around JARVIS/TITAN. Their repositories are **not copied into the JARVIS source tree**. TITAN talks to each capability through a defined boundary (HTTP/API, MCP, CLI, or local runtime).

## Stack map

| Project | TITAN role | Integration boundary |
|---|---|---|
| Node.js | Core runtime for JARVIS bridge/frontend tooling | Native runtime |
| Ollama | Local LLM/model runtime | OpenAI-compatible HTTP API |
| Activepieces | Workflow/automation execution | MCP server / HTTPS |
| Context Mode | Context-window optimization + session continuity | MCP + agent hooks |
| ECC (Everything Claude Code) | Agent skills, verification, memory/harness patterns | Agent/plugin layer |
| Free Claude Code | Optional local multi-agent/model routing layer | Local proxy/CLI |
| MoneyPrinterTurbo | Short-form video generation worker | HTTP API / separate service |
| Open-Generative-AI | Image/video/cinema/lip-sync generation worker | Separate app/service boundary |
| VoiceStudio | Local voice/STT/TTS provider | OpenAI-compatible HTTP API |
| ElevenLabs | Cloud Executive/Alert voice fallback | Server-side API |

## Runtime boundaries

### Core
JARVIS remains the orchestration shell and browser face. Node.js remains the runtime.

### Intelligence
Ollama is an optional local model provider. Its OpenAI-compatible API is normally exposed at `http://127.0.0.1:11434/v1`.

### Automation
Activepieces is the workflow engine. TITAN should connect through its MCP endpoint rather than importing Activepieces source.

### Agent engineering
Context Mode provides context routing/session continuity through MCP and hooks. ECC provides agent skills, verification, security, and memory patterns. These remain agent-layer dependencies, not application business logic.

### Model routing
Free Claude Code is an optional sidecar/local proxy. It must not replace the JARVIS bridge. TITAN may use it as a model-routing layer when explicitly configured.

### Media
MoneyPrinterTurbo and Open-Generative-AI are media workers. TITAN should submit jobs and consume artifacts; it should not vendor their large application trees into JARVIS.

### Voice
VoiceStudio remains the local-first voice provider already implemented on `feature/voicestudio-integration`. ElevenLabs remains the cloud fallback with the existing Executive/Alert routing.

## Security rules

1. No API keys, OAuth tokens, or provider secrets are committed.
2. Remote services use HTTPS and authentication.
3. Local-only services bind to loopback unless there is a deliberate deployment reason to expose them.
4. TITAN receives capabilities through narrow adapters rather than arbitrary shell access.
5. External repositories remain separately versioned so their licenses and upgrades can be managed independently.

## Suggested capability routing

- `chat` / reasoning → configured TITAN model provider (Claude or Ollama)
- `automation` → Activepieces
- `context` → Context Mode
- `agent skills / verification` → ECC
- `model fallback / routing` → Free Claude Code (optional)
- `tts / stt` → VoiceStudio → ElevenLabs fallback
- `short video` → MoneyPrinterTurbo
- `image/video/cinema/lipsync` → Open-Generative-AI
- `orchestration` → JARVIS bridge

This keeps TITAN modular: replacing a worker does not require rebuilding the executive/orchestration layer.

| n8n | Workflow automation alternative / broad integration layer | MCP / HTTPS |
| ComfyUI | Image-generation workflow engine | HTTP API / separate service |
| Dify | Agentic workflow, RAG, and AI application layer | API / MCP / separate service |
| Vane | Self-hosted search and RAG/retrieval layer | HTTP API / separate service |
| LibreChat | Multi-provider AI workspace and agent interface | API / separate service |

### Additional capability boundaries

**n8n** is an additional automation engine alongside Activepieces. TITAN should treat them as interchangeable workflow backends rather than running both for the same job.

**ComfyUI** is a specialized visual generation workflow engine. TITAN should submit generation workflows/jobs and consume resulting assets rather than importing the ComfyUI application source.

**Dify** is an application/agent workflow layer suitable for RAG, tool use, and AI application orchestration. It remains a service behind TITAN rather than becoming TITAN's core orchestrator.

**Vane** is a retrieval/search capability. TITAN can use it when a self-hosted search/RAG path is explicitly configured.

**LibreChat** is an optional multi-provider AI workspace/agent interface. TITAN may use it as an operator-facing AI surface or provider gateway, but it does not replace the JARVIS executive shell.

## Expanded capability routing

- `workflow` → Activepieces or n8n
- `image generation workflows` → ComfyUI
- `agentic apps / RAG workflows` → Dify
- `web/search/retrieval` → Vane
- `multi-provider chat workspace` → LibreChat
