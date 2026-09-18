---
name: titan-voice
description: Use for JARVIS voice, STT, TTS, ElevenLabs, VoiceStudio, and voice-role routing changes.
---

# TITAN Voice

Preserve these roles:
- Executive: tVb4QGWh6bdIXHLleu7W
- Alert: CwhRBWXzGAHq8TQ4Fs17

Rules:
- Browser code never receives the ElevenLabs API key.
- Bridge/provider adapters own credentials and network calls.
- VoiceStudio is an external provider; do not vendor its source.
- Provider selection must distinguish auto, VoiceStudio, ElevenLabs, and none.
- Alert/error speech must remain explicitly routable.
- If a provider is unavailable, use the documented fallback or explicit unavailable state.
- Test both Executive and Alert routing whenever voice routing changes.
