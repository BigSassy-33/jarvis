import crypto from 'node:crypto'

const DEFAULT_TIMEOUT_MS = 15_000

function configuration(raw = process.env) {
  const apiUrl = String(raw.TITAN_WORKFORCE_API_URL ?? '').trim().replace(/\/$/, '')
  const apiKey = String(raw.TITAN_WORKFORCE_API_KEY ?? '').trim()
  let validUrl = false
  try {
    const parsed = new URL(apiUrl)
    validUrl =
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (raw.NODE_ENV !== 'production' || parsed.protocol === 'https:')
  } catch {}
  return { ok: Boolean(apiUrl && apiKey && validUrl), apiUrl, apiKey }
}

async function request(path, init = {}, raw = process.env) {
  const cfg = configuration(raw)
  if (!cfg.ok) return { ok: false, status: 503, error: 'TITAN Workforce is not configured' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(raw.TITAN_WORKFORCE_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS))
  try {
    const response = await fetch(`${cfg.apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
        'x-correlation-id': crypto.randomUUID(),
        ...(init.headers ?? {}),
      },
    })
    const text = await response.text()
    let body = {}
    try { body = text ? JSON.parse(text) : {} } catch {}
    return { ok: response.ok, status: response.status, body }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error?.name === 'AbortError' ? 'TITAN Workforce request timed out' : 'TITAN Workforce could not be reached',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function submitObjective(text, raw = process.env) {
  const objective = String(text ?? '').trim()
  if (!objective) return { state: 'invalid', message: 'Workforce objective is required' }
  const result = await request('/objectives', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: objective }),
  }, raw)
  if (!result.ok) {
    return {
      state: result.status === 503 ? 'unavailable' : 'rejected',
      status: result.status,
      message: result.body?.error ?? result.error ?? 'TITAN Workforce rejected the objective',
      correlationId: result.body?.correlation_id ?? null,
    }
  }
  return {
    state: 'accepted',
    objectiveId: result.body?.data?.id ?? null,
    correlationId: result.body?.correlation_id ?? null,
  }
}

export async function startRun(objectiveId, raw = process.env) {
  const id = String(objectiveId ?? '').trim()
  if (!id) return { state: 'invalid', message: 'Workforce objective ID is required' }
  const result = await request('/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objective_id: id }),
  }, raw)
  if (!result.ok) {
    return {
      state: result.status === 503 ? 'unavailable' : 'rejected',
      status: result.status,
      message: result.body?.error ?? result.error ?? 'TITAN Workforce rejected the run',
      correlationId: result.body?.correlation_id ?? null,
    }
  }
  return {
    state: 'accepted',
    runId: result.body?.data?.id ?? null,
    correlationId: result.body?.correlation_id ?? null,
  }
}

export { configuration, request }
