---
name: titan-integration
description: Use when adding or extending external TITAN service integrations such as VoiceStudio, Ollama, n8n, Activepieces, ComfyUI, Dify, Vane, or LibreChat.
---

# TITAN Integration

Before implementing:
- verify the service's current documented API/protocol;
- define the narrowest adapter boundary;
- identify configuration and secret requirements;
- define unavailable and error behavior;
- keep the external project source separate.

Never turn a registry entry or documentation page into a claim that an integration is live. Live status requires an actual health/capability check.
