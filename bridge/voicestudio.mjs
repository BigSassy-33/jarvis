/**
 * TITAN VoiceStudio provider adapter.
 *
 * VoiceStudio stays a separate local/remote service. JARVIS only speaks to its
 * OpenAI-compatible HTTP API; no VoiceStudio source is copied into this repo.
 *
 * Provider selection:
 *   auto        VoiceStudio when reachable, otherwise ElevenLabs
 *   voicestudio VoiceStudio only
 *   elevenlabs  ElevenLabs only
 */
const DEFAULT_BASE_URL = 'http://127.0.0.1:3900'
const REQUEST_TIMEOUT_MS = 2500
const PROBE_TTL_MS = 5000

let probeAt = 0
let probeOk = false
let probePromise = null

function baseUrl() {
  return (
    process.env.TITAN_VOICESTUDIO_URL ??
    process.env.VOICESTUDIO_URL ??
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '')
}

function providerMode() {
  const value = (process.env.TITAN_VOICE_PROVIDER ?? 'auto').trim().toLowerCase()
  return ['auto', 'voicestudio', 'elevenlabs'].includes(value) ? value : 'auto'
}

function authHeaders() {
  const key = process.env.TITAN_VOICESTUDIO_API_KEY
  return key ? { authorization: `Bearer ${key}` } : {}
}

function safeRemoteUrl() {
  try {
    const url = new URL(baseUrl())
    const loopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]'
    if (!loopback && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

async function fetchWithTimeout(url, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'error' })
  } finally {
    clearTimeout(timer)
  }
}

export async function voiceStudioAvailable() {
  const now = Date.now()
  if (now - probeAt < PROBE_TTL_MS) return probeOk
  if (probePromise) return probePromise

  probePromise = (async () => {
    const root = safeRemoteUrl()
    if (!root) {
      probeOk = false
      probeAt = Date.now()
      return false
    }

    try {
      const res = await fetchWithTimeout(
        `${root.origin}/.well-known/voicestudio-speech`,
        { headers: authHeaders() },
      )
      probeOk = res.ok
    } catch {
      probeOk = false
    } finally {
      probeAt = Date.now()
      probePromise = null
    }
    return probeOk
  })()

  return probePromise
}

export async function resolveVoiceProvider(elevenLabsAvailable) {
  const mode = providerMode()
  if (mode === 'elevenlabs') return elevenLabsAvailable ? 'elevenlabs' : 'none'

  const vs = await voiceStudioAvailable()
  if (vs) return 'voicestudio'

  if (mode === 'voicestudio') return 'none'
  return elevenLabsAvailable ? 'elevenlabs' : 'none'
}

function voiceFor(role) {
  const key =
    role === 'alert'
      ? 'TITAN_VOICESTUDIO_ALERT_VOICE'
      : 'TITAN_VOICESTUDIO_EXECUTIVE_VOICE'
  return process.env[key] || process.env.TITAN_VOICESTUDIO_VOICE || 'default'
}

function modelId() {
  return process.env.TITAN_VOICESTUDIO_MODEL || 'tts-1'
}

export async function tryVoiceStudioSpeech(req, res, cors, role = 'executive') {
  const bodyChunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 64 * 1024) {
      res.writeHead(400, cors)
      res.end('body too large')
      return true
    }
    bodyChunks.push(chunk)
  }

  let text
  let role = 'executive'
  try {
    ;({ text, role } = JSON.parse(Buffer.concat(bodyChunks).toString('utf8') || '{}'))
    if (role !== 'executive' && role !== 'alert') role = 'executive'
  } catch {
    res.writeHead(400, cors)
    res.end('bad json')
    return true
  }
  if (!text) {
    res.writeHead(400, cors)
    res.end('no text')
    return true
  }

  const root = safeRemoteUrl()
  if (!root) {
    res.writeHead(503, cors)
    res.end('VoiceStudio URL is invalid or requires HTTPS')
    return true
  }

  try {
    const upstream = await fetchWithTimeout(
      `${root.origin}/v1/audio/speech`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId(),
          voice: voiceFor(role),
          input: text,
          response_format: 'mp3',
          speed: 1.05,
        }),
      },
      Number(process.env.TITAN_VOICESTUDIO_TIMEOUT_MS ?? 30000),
    )

    if (!upstream.ok) {
      res.writeHead(upstream.status, {
        ...cors,
        'content-type': 'text/plain; charset=utf-8',
      })
      res.end(await upstream.text())
      return true
    }

    res.writeHead(200, {
      ...cors,
      'content-type': upstream.headers.get('content-type') || 'audio/mpeg',
      'cache-control': 'no-cache',
    })

    if (upstream.body) {
      for await (const chunk of upstream.body) res.write(Buffer.from(chunk))
    }
    res.end()
    return true
  } catch (err) {
    res.writeHead(502, cors)
    res.end(String(err?.message ?? err))
    return true
  }
}

export async function tryVoiceStudioTranscription(req, res, cors) {
  const type = String(req.headers['content-type'] || 'audio/webm')
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > 25 * 1024 * 1024) {
      res.writeHead(413, cors)
      res.end('audio too large')
      return true
    }
    chunks.push(chunk)
  }

  if (size < 1200) {
    res.writeHead(200, { ...cors, 'content-type': 'application/json' })
    res.end(JSON.stringify({ text: '' }))
    return true
  }

  const root = safeRemoteUrl()
  if (!root) {
    res.writeHead(503, cors)
    res.end('VoiceStudio URL is invalid or requires HTTPS')
    return true
  }

  const ext = type.includes('ogg')
    ? 'ogg'
    : type.includes('mp4') || type.includes('mpeg')
      ? 'mp4'
      : type.includes('wav')
        ? 'wav'
        : 'webm'

  const form = new FormData()
  form.append(
    'file',
    new Blob([Buffer.concat(chunks)], { type }),
    `speech.${ext}`,
  )
  form.append(
    'model',
    process.env.TITAN_VOICESTUDIO_STT_MODEL || 'whisperx',
  )
  form.append('response_format', 'json')

  try {
    const upstream = await fetchWithTimeout(
      `${root.origin}/v1/audio/transcriptions`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      },
      Number(process.env.TITAN_VOICESTUDIO_TIMEOUT_MS ?? 30000),
    )

    if (!upstream.ok) {
      res.writeHead(upstream.status, cors)
      res.end(await upstream.text())
      return true
    }

    const data = await upstream.json()
    res.writeHead(200, { ...cors, 'content-type': 'application/json' })
    res.end(JSON.stringify({ text: String(data?.text ?? '').trim() }))
    return true
  } catch (err) {
    res.writeHead(502, cors)
    res.end(String(err?.message ?? err))
    return true
  }
}
